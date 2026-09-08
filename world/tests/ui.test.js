import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,readPrefs} from '../src/ui.js';
import {ReadingMemory} from '../src/exhibition-state.js';
import {freshProgress} from '../src/logic.js';

// A small DOM boundary lets these tests exercise the real reader methods and generated HTML.
// Rendering, focus visibility and browser history events are verified in browser QA.
function reader(){
  const previous={document:globalThis.document,location:globalThis.location,history:globalThis.history};
  const elements=new Map();
  const element=key=>{
    if(!elements.has(key)){const classes=new Set(),attributes=new Map();elements.set(key,{innerHTML:'',textContent:'',scrollTop:0,hidden:true,dataset:{},style:{},isConnected:true,classList:{add(value){classes.add(value);},remove(value){classes.delete(value);},contains(value){return classes.has(value);},toggle(value,force){if(force??!classes.has(value))classes.add(value);else classes.delete(value);}},querySelector(selector){return element(selector);},setAttribute(name,value){attributes.set(name,String(value));},getAttribute(name){return attributes.get(name)||null;},closest(){return null;},focus(){globalThis.document.activeElement=this;}});}
    return elements.get(key);
  };
  globalThis.document={activeElement:element('source'),documentElement:{classList:element('document').classList}};
  globalThis.location=new URL('https://portfolio.example/');
  globalThis.history={state:{},pushState(state,unused,url){this.state=state;globalThis.location=new URL(url,globalThis.location);},replaceState(state,unused,url){this.state=state;globalThis.location=new URL(url,globalThis.location);}};
  const ui=Object.create(Interface.prototype);Object.assign(ui,{root:{querySelector:element,querySelectorAll(){return[];}},canvas:element('canvas'),options:{lang:'en'},snapshot:{progress:freshProgress()},readingMemory:new ReadingMemory(),historyDepth:0,view:null,entity:null,exhibition:null,t:key=>key,persist(){},applyLanguage(){}});
  return {ui,element,restore(){Object.assign(globalThis,previous);}};
}

test('changing language retains exact paper identity and its reading position',()=>{
  const {ui,element,restore}=reader();try{
    ui.openPaper('dvin');element('#page-content').scrollTop=364;
    ui.toggleLanguage();
    assert.equal(ui.options.lang,'zh');assert.equal(ui.paperId,'dvin');
    assert.deepEqual(ui.entity,{kind:'paper',id:'dvin'});
    assert.equal(element('#page-content').scrollTop,364);
    assert.ok(element('#page-content').innerHTML.includes('data-entity-id="dvin"'));
    assert.ok(!element('#page-content').innerHTML.includes('data-entity-id="apl"'));
    assert.equal(location.hash,'#paper/dvin');assert.equal(location.search,'?lang=zh');
  }finally{restore();}
});

test('media changes replace history and language keeps the selected media and scroll',()=>{
  const {ui,element,restore}=reader();try{
    ui.openProject('autodesign',{mediaIndex:2});const depth=ui.historyDepth;
    element('#page-content').scrollTop=570;ui.setExhibitMedia(3);
    assert.equal(ui.historyDepth,depth);assert.equal(ui.activeMediaIndex(),3);
    ui.toggleLanguage();assert.equal(ui.activeMediaIndex(),3);assert.equal(element('#page-content').scrollTop,570);
    assert.ok(location.hash.includes('media=3'));assert.equal(ui.entity.id,'autodesign');
  }finally{restore();}
});

test('closing a direct paper link returns to a stable site entry',()=>{
  const {ui,element,restore}=reader();try{
    ui.openPaper('apl',{history:'replace'});ui.close();
    assert.equal(ui.view,null);assert.equal(ui.entity,null);assert.equal(location.hash,'');
    assert.equal(element('.modal-backdrop').hidden,true);
  }finally{restore();}
});


test('CV downloads and accessible labels follow language changes in every persistent entry',()=>{
  const {ui,element,restore}=reader();try{
    const cv=element('.persistent-cv'),modalCV=element('.modal-cv'),quickCV=element('.quick-links a');
    ui.root.querySelectorAll=selector=>selector==='.header-nav .nav-link,.modal-tool'?[cv]:selector==='.persistent-cv,.modal-cv'?[cv,modalCV]:selector==='a[data-i18n="cv"]'?[quickCV]:[];
    ui.t=key=>key==='cv'?(ui.options.lang==='zh'?'打开简历':'Open CV'):key;ui.updateStatus=()=>{};
    Interface.prototype.applyLanguage.call(ui);
    assert.equal(cv.getAttribute('aria-label'),'Open CV · PDF');
    for(const link of [cv,modalCV,quickCV])assert.equal(link.getAttribute('href'),'/files/CV_YaxinLuo.pdf');
    ui.options.lang='zh';Interface.prototype.applyLanguage.call(ui);
    assert.equal(cv.getAttribute('aria-label'),'打开简历 · PDF');assert.equal(modalCV.getAttribute('aria-label'),'打开简历 · PDF');
    for(const link of [cv,modalCV,quickCV])assert.equal(link.getAttribute('href'),'/files/CV_YaxinLuo_zh.pdf');
    ui.options.lang='en';Interface.prototype.applyLanguage.call(ui);
    for(const link of [cv,modalCV,quickCV])assert.equal(link.getAttribute('href'),'/files/CV_YaxinLuo.pdf');
  }finally{restore();}
});

test('returning from an intro-origin exhibition restores the welcome and its accessibility',()=>{
  const {ui,element,restore}=reader();try{
    const welcome=['.welcome','.arrival-card','.intro-footer'].map(element);
    welcome.forEach(el=>{el.inert=true;el.setAttribute('aria-hidden','true');});
    ui.root.querySelectorAll=selector=>selector==='.welcome,.arrival-card,.intro-footer'?welcome:[];
    element('.experience').classList.add('playing');element('.game-interface').hidden=false;
    ui.syncStarted(false);
    assert.equal(element('.experience').classList.contains('playing'),false);
    assert.equal(element('.game-interface').hidden,true);
    assert.ok(welcome.every(el=>el.inert===false&&el.getAttribute('aria-hidden')==='false'));
  }finally{restore();}
});

test('clock mode updates the setting without echoing an option change into the game',()=>{
  const {ui,element,restore}=reader();try{
    let writes=0;ui.persist=()=>writes++;ui.game={setOption(){throw new Error('recursive option update');}};
    ui.applyTimeMode('dusk');assert.equal(ui.options.timeOfDay,'dusk');assert.equal(element('[data-option="timeOfDay"]').value,'dusk');assert.equal(writes,1);
    ui.applyTimeMode('invalid');assert.equal(ui.options.timeOfDay,'dusk');assert.equal(writes,1);
  }finally{restore();}
});

test('closing an exhibition exits every internal project switch in one step',()=>{
  const {ui,restore}=reader();try{
    const moves=[];history.go=delta=>moves.push(delta);
    ui.exhibition={projectId:'dvin',mediaIndex:0};ui.exhibitionReturn={route:{kind:'section',id:'projects'},depth:1,focus:{action:'exhibition',id:'autodesign'}};ui.historyDepth=4;
    ui.closeExhibition();ui.closeExhibition();
    assert.deepEqual(moves,[-3]);assert.deepEqual(ui.pendingReturnFocus,{action:'exhibition',id:'autodesign'});
  }finally{restore();}
});

test('nearby artifact names are bilingual and follow the physical interaction priority',()=>{
  const {ui,element,restore}=reader();try{
    ui.ready=true;const snapshot={started:false,progress:freshProgress(),health:100,mana:100,position:{x:0,y:10,z:0},nearestPaper:'dvin',nearestArtifact:{action:{kind:'cv'},label:{en:'CV folder',zh:'简历资料夹'}}};
    ui.update(snapshot);assert.equal(element('.interaction-prompt').hidden,false);assert.equal(element('#nearby-name').textContent,'CV folder');
    ui.options.lang='zh';ui.update(snapshot);assert.equal(element('#nearby-name').textContent,'简历资料夹');
    ui.update({...snapshot,nearestClock:true});assert.equal(element('#nearby-name').textContent,'天文钟 · 选择时段');
    ui.update({...snapshot,nearestClock:true,nearestExhibition:'autodesign'});assert.equal(element('#nearby-name').textContent,'AutoDesign');
    ui.exhibition={projectId:'autodesign',mediaIndex:0};ui.update(snapshot);assert.equal(element('.interaction-prompt').hidden,true);
  }finally{restore();}
});

test('settings report actual audio readiness and offer retry only for enabled failed audio',()=>{
  const {ui,element,restore}=reader();try{
    ui.ready=true;ui.view='settings';const snapshot={started:false,progress:freshProgress(),health:100,mana:100,position:{x:0,y:10,z:0}};
    for(const [audio,key,retry] of [[{enabled:false,status:'ready'},'audioMuted',false],[{enabled:true,status:'loading'},'audioLoading',false],[{enabled:true,status:'ready'},'audioReady',false],[{enabled:true,status:'unavailable'},'audioUnavailable',true]]){
      ui.update({...snapshot,audio});assert.equal(element('#audio-status').textContent,key);assert.equal(element('[data-action="audio-retry"]').hidden,!retry);
    }
  }finally{restore();}
});

test('explore and travel enqueue explicit intent; opening a paper prevents late focus transfer',()=>{
  const {ui,element,restore}=reader();try{
    let attempts=0,started=0;ui.toast=()=>{};ui.setLoadingController({start(){attempts++;}});
    ui.action('start');assert.equal(attempts,1);assert.equal(ui.pendingStart.kind,'start');
    ui.travel('research');assert.equal(ui.pendingStart.kind,'travel');assert.equal(ui.pendingStart.id,'research');
    ui.openPaper('dvin');const focus=document.activeElement;
    ui.setGame({start(){started++;},setPaused(value){assert.equal(value,true);}});
    assert.equal(started,0);assert.equal(ui.paperId,'dvin');assert.equal(document.activeElement,focus);assert.equal(element('.modal-backdrop').hidden,false);
  }finally{restore();}
});

test('a pending teleport is performed once on attachment and closing invalidates the intent',()=>{
  const {ui,restore}=reader();try{
    const teleports=[];ui.flash=()=>{};ui.toast=()=>{};
    ui.travel('research');ui.setGame({travel:id=>teleports.push(id),setPaused(){}});
    assert.deepEqual(teleports,['research']);assert.equal(ui.pendingStart,null);
    ui.game=null;ui.action('start');ui.close({history:'replace',all:true});assert.equal(ui.pendingStart,null);
  }finally{restore();}
});

test('requested spatial exhibition starts loading but subsequent paper navigation remains in place',()=>{
  const {ui,restore}=reader();try{
    let attempts=0;ui.setLoadingController({start(){attempts++;}});ui.openExhibition('autodesign');
    assert.equal(attempts,1);assert.equal(ui.pendingStart.kind,'exhibition');
    ui.openPaper('apl');const focus=document.activeElement;
    ui.setGame({enterExhibit(){throw new Error('stale exhibition stole focus');},setPaused(){}});
    assert.equal(ui.paperId,'apl');assert.equal(document.activeElement,focus);
  }finally{restore();}
});

test('loading UI shows bytes, bounded slow notice and retry while retaining the explore entry',()=>{
  const {ui,element,restore}=reader();try{
    ui.applyLoadingState({availability:'loading-core-3d',phase:'parsing',receivedBytes:1200000,slow:true});
    assert.equal(element('.world-loading').hidden,false);assert.equal(element('.world-loading-status').textContent,'coreParsing');
    assert.match(element('.world-loading-detail').textContent,/1.2 MB received.*coreSlow/);assert.doesNotMatch(element('.world-loading-detail').textContent,/%/);
    ui.applyLoadingState({availability:'static-only',error:{type:'timeout'}});
    assert.equal(element('[data-action="world-retry"]').hidden,false);assert.equal(element('#explore-button').getAttribute('aria-busy'),'false');
    ui.applyLoadingState({availability:'loading-core-3d',phase:'engine'});assert.equal(ui.failed,false);
  }finally{restore();}
});

test('changing language in a pending exhibition keeps the requested destination',()=>{
  const {ui,restore}=reader();try{
    ui.openExhibition('autodesign');const pending=ui.pendingStart;
    ui.toggleLanguage();assert.equal(ui.pendingStart,pending);assert.equal(ui.options.lang,'zh');
  }finally{restore();}
});

test('legacy time preferences migrate without changing fixed modes and new presets survive reload',()=>{
  const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),originalMedia=globalThis.matchMedia;
  globalThis.matchMedia=()=>({matches:false});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:null});
  try{
    for(const timeOfDay of ['auto','dawn','day','noon','dusk','night','midnight']){
      globalThis.localStorage={getItem:()=>JSON.stringify({timeOfDay,gameplay:false})};
      assert.equal(readPrefs().timeOfDay,timeOfDay);assert.equal(readPrefs().gameplay,false);
    }
    globalThis.localStorage={getItem:()=>'{broken'};assert.equal(readPrefs().timeOfDay,'auto');
    globalThis.localStorage={getItem:()=>JSON.stringify({timeOfDay:'unknown'})};assert.equal(readPrefs().timeOfDay,'auto');
  }finally{
    if(originalStorage===undefined)delete globalThis.localStorage;else Object.defineProperty(globalThis,'localStorage',originalStorage);
    if(originalMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=originalMedia;
  }
});

test('one HUD contains prompt, clock, exploration, combat and touch controls when optional play is off',()=>{
  const {ui,restore}=reader();try{
    ui.options={lang:'en',gameplay:false};ui.snapshot.position={x:0,y:10,z:0};ui.render();
    const hud=ui.root.innerHTML.match(/<section class="world-hud"[^>]*>([\s\S]*?)<\/section>/)?.[1];assert.ok(hud);
    for(const feature of ['interaction-prompt','world-clock','exploration-actions','flight-hud','touch-controls'])assert.ok(hud.includes(`class="${feature}"`),feature);
    assert.match(hud,/class="world-clock"[^>]*aria-live="off"/);assert.match(hud,/<time id="world-clock-time">/);
    assert.ok(hud.indexOf('data-action="illumination"')<hud.indexOf('class="spellbar"'));
    assert.match(ui.controlsContent(),/<kbd>L<\/kbd>/);assert.match(ui.controlsContent(),/<kbd>B<\/kbd>/);
  }finally{restore();}
});

test('clock display is rate-limited and fixed/paused changes appear immediately',()=>{
  const {ui,element,restore}=reader();try{
    const base={started:true,paused:false,locomotion:'grounded',illumination:{enabled:false,available:true},environment:{mode:'auto',phase:.5,period:'noon',clockText:'12:00',clockState:'auto'}};
    ui.updateWorldHUD(base,{now:0});assert.equal(element('#world-clock-time').textContent,'12:00');
    const later={...base,environment:{...base.environment,clockText:'12:01'}};
    ui.updateWorldHUD(later,{now:100});assert.equal(element('#world-clock-time').textContent,'12:00');
    ui.updateWorldHUD(later,{now:250});assert.equal(element('#world-clock-time').textContent,'12:01');
    ui.updateWorldHUD({...base,environment:{...base.environment,mode:'noon',clockState:'fixed'}},{now:260});assert.equal(element('.world-clock').dataset.state,'fixed');
    ui.updateWorldHUD({...base,paused:true,environment:{...base.environment,clockState:'paused',pauseReason:'reduced-motion'}},{now:270});assert.equal(element('#world-clock-state').textContent,'clockMotion');
    assert.equal(element('[data-action="illumination"]').disabled,true);
  }finally{restore();}
});

test('illumination and mount controls work outside gameplay and reflect movement state',()=>{
  const {ui,element,restore}=reader();try{
    ui.options.gameplay=false;const calls=[];ui.game={toggleIllumination:()=>calls.push('light'),toggleBroom:()=>calls.push('broom')};
    const state={started:true,locomotion:{mode:'grounded'},illumination:{enabled:true,available:true}};
    ui.updateWorldHUD(state,{now:0});assert.equal(element('[data-action="illumination"]').disabled,false);assert.equal(element('[data-action="illumination"]').getAttribute('aria-pressed'),'true');
    assert.equal(element('[data-hud-label="broom"]').textContent,'summonBroom');ui.action('illumination');ui.action('broom');assert.deepEqual(calls,['light','broom']);
    ui.updateWorldHUD({...state,locomotion:'flying'},{now:10});assert.equal(element('[data-hud-label="broom"]').textContent,'landBroom');
    ui.updateWorldHUD({...state,locomotion:'mounting'},{now:20});assert.equal(element('[data-action="broom"]').disabled,true);
    ui.view='settings';ui.action('illumination');ui.action('broom');assert.deepEqual(calls,['light','broom']);
  }finally{restore();}
});

test('time settings distinguish a fixed preset from an explicit jump-and-continue action',()=>{
  const {ui,restore}=reader();try{
    const calls=[];ui.game={started:true,setPaused:value=>calls.push(['pause',value]),jumpToTime:value=>calls.push(['jump',value])};ui.options.timeOfDay='night';
    const settings=ui.timeSettingsContent();assert.match(settings,/value="night" selected>fixed: night/);assert.match(settings,/data-action="time-jump" data-id="midnight"/);
    ui.view='settings';ui.action('time-jump','dawn');assert.deepEqual(calls,[['pause',false],['jump','dawn']]);assert.equal(ui.view,null);
    ui.action('time-jump','unknown');assert.equal(calls.length,2);
    ui.applyTimeMode('auto');assert.equal(ui.options.timeOfDay,'auto');
  }finally{restore();}
});
