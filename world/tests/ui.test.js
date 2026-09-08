import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from '../src/ui.js';
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


test('CV keeps a meaningful bilingual accessible name after language application',()=>{
  const {ui,element,restore}=reader();try{
    const cv=element('.persistent-cv'),modalCV=element('.modal-cv');
    ui.root.querySelectorAll=selector=>selector==='.header-nav .nav-link,.modal-tool'?[cv]:selector==='.persistent-cv,.modal-cv'?[cv,modalCV]:[];
    ui.t=key=>key==='cv'?(ui.options.lang==='zh'?'打开简历':'Open CV'):key;ui.updateStatus=()=>{};
    Interface.prototype.applyLanguage.call(ui);
    assert.equal(cv.getAttribute('aria-label'),'Open CV · PDF');
    ui.options.lang='zh';Interface.prototype.applyLanguage.call(ui);
    assert.equal(cv.getAttribute('aria-label'),'打开简历 · PDF');assert.equal(modalCV.getAttribute('aria-label'),'打开简历 · PDF');
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
