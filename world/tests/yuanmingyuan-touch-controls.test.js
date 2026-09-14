import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumTouchControls} from '../src/yuanmingyuan/touch-controls.js';

class Target extends EventTarget{
  constructor(action){super();this.dataset={action};this.style={};const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,yes)=>yes?classes.add(c):classes.delete(c)};}
  getBoundingClientRect(){return {left:20,top:30,width:100,height:100};}
  setPointerCapture(id){this.captured=id;}
  send(type,pointerId,x=70,y=80){const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId,clientX:x,clientY:y});this.dispatchEvent(event);return event;}
}
function setup(options={}){const pad=new Target(),knob=new Target(),up=new Target('up'),down=new Target('down'),boost=new Target('boost');const input=createMuseumTouchControls({pad,knob,buttons:[up,down,boost],...options});return {pad,knob,up,down,boost,input};}

test('dragging outside the pad preserves direction without faster diagonal movement',()=>{
  const {pad,input}=setup();pad.send('pointerdown',1,110,40);const first=input.snapshot();assert.ok(Math.abs(Math.hypot(first.x,first.z)-1)<1e-10);assert.ok(first.x>0&&first.z>0);
  pad.send('pointermove',2,30,100);assert.deepEqual(input.snapshot(),first,'another finger must not seize the movement pad');
  pad.send('pointermove',1,70,80);assert.deepEqual(input.snapshot(),{x:0,z:0,vertical:0,boost:false});input.dispose();
});
test('movement, altitude and boost may be held by independent fingers',()=>{
  const {pad,up,down,boost,input}=setup();pad.send('pointerdown',1,100,80);up.send('pointerdown',2);boost.send('pointerdown',3);
  assert.ok(input.snapshot().x>0);assert.equal(input.snapshot().vertical,1);assert.equal(input.snapshot().boost,true);
  up.send('lostpointercapture',2);assert.equal(input.snapshot().vertical,0);assert.equal(input.snapshot().boost,true);
  down.send('pointerdown',4);assert.equal(input.snapshot().vertical,-1);pad.send('pointercancel',1);assert.equal(input.snapshot().x,0);assert.equal(input.snapshot().boost,true);input.dispose();
});
test('releasing one of two boost pointers does not cancel the other',()=>{
  const {boost,input}=setup();boost.send('pointerdown',1);boost.send('pointerdown',2);boost.send('pointerup',1);assert.equal(input.snapshot().boost,true);boost.send('pointercancel',2);assert.equal(input.snapshot().boost,false);input.dispose();
});
test('pausing, clearing and aborting cannot leave movement or a stuck action',()=>{
  let active=true;const abort=new AbortController(),{pad,up,input}=setup({signal:abort.signal,isActive:()=>active});
  pad.send('pointerdown',1,100,80);up.send('pointerdown',2);active=false;pad.send('pointermove',1,100,70);assert.deepEqual(input.snapshot(),{x:0,z:0,vertical:0,boost:false});
  up.send('pointerdown',3);assert.equal(input.snapshot().vertical,0);active=true;up.send('pointerdown',4);assert.equal(input.snapshot().vertical,1);
  abort.abort();assert.deepEqual(input.snapshot(),{x:0,z:0,vertical:0,boost:false});pad.send('pointerdown',5,110,40);assert.equal(input.snapshot().x,0);
});
