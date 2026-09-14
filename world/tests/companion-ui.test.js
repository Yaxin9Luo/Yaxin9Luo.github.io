import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from '../src/ui.js';
function fixture(){
  const elements=new Map(),node=selector=>{if(!elements.has(selector))elements.set(selector,{style:{},dataset:{},classList:{toggle(){}},setAttribute(){}});return elements.get(selector);};
  const ui=Object.create(Interface.prototype);Object.assign(ui,{root:{querySelector:node,querySelectorAll:()=>[]},options:{lang:'en'},t:key=>key,syncStarted(){},updateWorldHUD(){},view:null,exhibition:null});
  const snapshot={started:true,paused:false,position:{x:0,y:7,z:0},progress:{visited:[],crystals:[]},health:100,mana:100,spell:0,shield:0,nearestCompanion:{id:'elizabeth',label:{en:'Elizabeth',zh:'伊丽莎白'},actionLabel:{en:'Say hello',zh:'打个招呼'}}};
  return {ui,node,snapshot};
}
test('the normal touch/E prompt shows current bilingual friendly labels and keeps portfolio priority',()=>{
  const {ui,node,snapshot}=fixture();ui.update(snapshot);assert.equal(node('.interaction-prompt').hidden,false);assert.equal(node('#nearby-name').textContent,'Elizabeth');assert.equal(node('.interaction-prompt strong').textContent,'Say hello');
  ui.options.lang='zh';ui.update(snapshot);assert.equal(node('#nearby-name').textContent,'伊丽莎白');assert.equal(node('.interaction-prompt strong').textContent,'打个招呼');
  ui.update({...snapshot,nearestClock:true});assert.match(node('#nearby-name').textContent,/天文钟/);assert.equal(node('.interaction-prompt strong').textContent,'clockJump');
  ui.update({...snapshot,paused:true});assert.equal(node('.interaction-prompt').hidden,true);ui.update({...snapshot,started:false});assert.equal(node('.interaction-prompt').hidden,true);
});
test('the existing touch interaction action dispatches to the same Game guard once',()=>{
  const {ui}=fixture();let called=0;ui.game={interact(){called++;}};ui.action('interact');assert.equal(called,1);
});
