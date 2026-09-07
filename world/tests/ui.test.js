import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from '../src/ui.js';

test('changing language keeps the selected exhibit paper in view',()=>{
  const ui=Object.create(Interface.prototype),events=[];
  ui.options={lang:'en'};ui.persist=()=>{};ui.applyLanguage=()=>{};
  ui.root={querySelector:selector=>({scrollIntoView:options=>events.push([selector,options.block])})};
  ui.open=function(view){this.view=view;this.paperId=null;events.push(view);};
  ui.openPaper('dvin');
  ui.toggleLanguage();
  assert.equal(ui.options.lang,'zh');
  assert.equal(ui.paperId,'dvin');
  assert.deepEqual(events.slice(-2),['publications',['#paper-dvin','start']]);
  ui.open('projects');ui.toggleLanguage();
  assert.equal(ui.paperId,null);
  assert.equal(events.at(-1),'projects');
});
