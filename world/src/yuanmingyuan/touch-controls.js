// One movement pointer and independent action pointers support moving, climbing
// and boosting at the same time. Lost capture must never leave a held action.
export function createMuseumTouchControls({pad,knob,buttons,isActive=()=>true,onInput=()=>{},signal}={}){
  const events=new AbortController(),actions=new Map();let pointer=null,axis={x:0,z:0},disposed=false;
  const listen=(target,name,handler)=>target.addEventListener(name,handler,{signal:events.signal});
  const snapshot=()=>({x:axis.x,z:axis.z,vertical:Number([...actions.values()].includes('up'))-Number([...actions.values()].includes('down')),boost:[...actions.values()].includes('boost')});
  const emit=()=>{knob.style.transform=`translate(${axis.x*34}px,${-axis.z*34}px)`;onInput(snapshot());};
  function update(event){
    const box=pad.getBoundingClientRect(),radius=Math.min(box.width,box.height)*.36;
    if(radius<=0)return;let x=(event.clientX-box.left-box.width/2)/radius,z=-(event.clientY-box.top-box.height/2)/radius;
    const distance=Math.hypot(x,z);if(distance<.12){x=0;z=0;}else{x/=Math.max(1,distance);z/=Math.max(1,distance);}
    axis={x,z};emit();
  }
  function releasePad(event){if(pointer!==event.pointerId)return;pointer=null;axis={x:0,z:0};emit();}
  listen(pad,'pointerdown',event=>{if(disposed||pointer!==null||!isActive())return;event.preventDefault();pointer=event.pointerId;pad.setPointerCapture(pointer);update(event);});
  listen(pad,'pointermove',event=>{if(event.pointerId===pointer){if(!isActive()){clear();return;}update(event);}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(pad,event,releasePad);
  for(const button of buttons){
    const action=button.dataset.action;
    const release=event=>{if(actions.delete(event.pointerId)){button.classList.toggle('held',[...actions.values()].includes(action));emit();}};
    listen(button,'pointerdown',event=>{if(disposed||!isActive())return;event.preventDefault();actions.set(event.pointerId,action);button.setPointerCapture(event.pointerId);button.classList.add('held');emit();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(button,event,release);
  }
  function clear(){pointer=null;axis={x:0,z:0};actions.clear();for(const button of buttons)button.classList.remove('held');emit();}
  function dispose(){if(disposed)return;disposed=true;clear();events.abort();signal?.removeEventListener('abort',dispose);}
  if(signal?.aborted)dispose();else signal?.addEventListener('abort',dispose,{once:true});
  return {snapshot,clear,dispose};
}
