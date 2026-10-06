// Portable mascot tour. The host supplies navigation; the guide owns its UI.
export const stops = [
  {id:'about', label:{en:'About me',zh:'关于我'}, place:{en:'The Grand Academy',zh:'中央魔法学院'}, title:{en:'Let’s meet the researcher.',zh:'先认识一下研究者。'}, text:{en:'Start here for Yaxin’s background, current work, and the question connecting his research.',zh:'这一站介绍 Yaxin 的背景、正在做的工作，以及贯穿研究的核心问题。'}},
  {id:'publications', label:{en:'Publications',zh:'学术论文'}, place:{en:'The Infinite Library',zh:'无尽图书馆'}, title:{en:'The ideas, written down.',zh:'把想法写成论文。'}, text:{en:'Browse the papers, then open one for its abstract, figures, and links. This is the place to go deeper.',zh:'在这里浏览论文，再打开感兴趣的一篇，查看摘要、图示和链接。想深入了解研究，就从这里开始。'}},
  {id:'projects', label:{en:'Projects',zh:'研究作品'}, place:{en:'The Artificer’s Atelier',zh:'造物者工坊'}, title:{en:'See what the ideas can do.',zh:'看看想法能做出什么。'}, text:{en:'Explore AutoDesign, FigMirror, and other projects through their demos and artifacts. A good stop if you prefer seeing things in action.',zh:'通过 demo 和作品认识 AutoDesign、FigMirror 等项目。比起读论文更想看实际效果的话，这一站很适合你。'}},
  {id:'research', label:{en:'Research',zh:'研究方向'}, place:{en:'The Astral Observatory',zh:'星象研究台'}, title:{en:'A little look ahead.',zh:'看看正在探索的方向。'}, text:{en:'Find the research questions behind the work: post-training, artifact design, and agents that can handle long, expert tasks.',zh:'这里解释工作背后的研究问题：post-training、artifact design，以及如何让智能体完成长程专家任务。'}},
  {id:'journey', label:{en:'Experience',zh:'研究经历'}, place:{en:'The Wayfarer’s Ruins',zh:'旅人的古迹'}, title:{en:'The path that led here.',zh:'一路是怎样走来的。'}, text:{en:'Follow Yaxin’s education and research experiences, and the people and places that shaped his work.',zh:'沿着求学和研究经历，了解一路上塑造这些工作的人与地方。'}},
  {id:'contact', label:{en:'Get in touch',zh:'联系我'}, place:{en:'The Owl Post',zh:'猫头鹰邮局'}, title:{en:'Your next conversation starts here.',zh:'下一次交流，从这里开始。'}, text:{en:'Looking to collaborate? Find email, academic profiles, GitHub, and the CV here. No owl required.',zh:'想聊合作？这里可以找到邮箱、学术主页、GitHub 和简历。不用真的派一只猫头鹰。'}}
];

const copy = {
  en:{start:'Start the tour',welcome:'A small guide to a little world.',hint:'Six short stops. Explore at your own pace.',close:'Dismiss guide',next:'Next stop',back:'Back',visit:'Read at your own pace',count:'STOP',done:'Enjoy exploring.',doneText:'That’s the little tour. The rest is yours to discover.',again:'Take another tour',finish:'Finish tour',bye:'Back to exploring',replay:'Say hello',resume:'Resume tour',audioError:'Sound couldn’t play. Try the sound button again.'},
  zh:{start:'开始导览',welcome:'小小导游，带你逛逛。',hint:'六个短站点，按你的节奏探索。',close:'彻底关闭导游',next:'下一站',back:'上一站',visit:'收起导览，慢慢读',count:'第',done:'慢慢逛，玩得开心。',doneText:'导览到这里就结束了。剩下的，留给你自己发现。',again:'再逛一次',finish:'结束导览',bye:'继续自由探索',replay:'打个招呼',resume:'继续导览',audioError:'声音未能播放，请再次点击声音按钮。'}
};

export function createGuide({root,assetBase='./assets/',lang='en',onVisit=()=>{},onStep=()=>{},onStateChange=()=>{}}) {
  if (!root) throw new Error('The mascot guide needs a root element.');
  const abort = new AbortController();
  const audio = new Audio(`${assetBase}guide-original-acoustic-v5.mp3`);
  audio.preload='auto'; audio.volume=.28;
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let state='idle', suspendedState='idle', index=0, sound=true, reduced=motionPreference.matches, returnFocus=null;
  let poseTimer=null, poseFrame=null, disposed=false, playbackRevision=0;
  let appearanceShown=false, autoplayPending=false;
  let drag=null, userPosition=null, suppressClick=false, positionFrame=null;
  root.classList.add('mascot-guide');
  root.innerHTML=`<div class="guide-actor"><button type="button" class="guide-character" data-guide="actor"><img class="guide-idle" src="${assetBase}mascot-idle.webp?v=3" alt=""><img class="guide-point" src="${assetBase}mascot-point.webp?v=3" alt=""></button><span class="guide-shadow" aria-hidden="true"></span></div><section class="guide-card" aria-labelledby="guide-heading"><div class="guide-topline"><button type="button" class="guide-drag"><span class="guide-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="guide-eyebrow"></span></button><button class="guide-sound" type="button" data-guide="sound">♪</button><button class="guide-close" type="button" data-guide="close">×</button></div><div class="guide-copy" aria-live="polite" aria-atomic="true"><h2 id="guide-heading"></h2><p class="guide-description"></p></div><div class="guide-stops" aria-label="Tour stops"></div><button type="button" class="guide-visit" data-guide="visit"></button><div class="guide-actions"><button class="guide-back" type="button" data-guide="back"></button><button class="guide-primary" type="button" data-guide="next"></button></div></section><p class="guide-audio-status" role="status"></p>`;
  const q=s=>root.querySelector(s);
  const character=q('.guide-character');
  const focus=(selector)=>q(selector)?.focus({preventScroll:true});
  const label=()=>copy[lang];
  function bounds() {
    const parent=root.offsetParent;
    if(!parent)return {left:0,top:0,width:innerWidth,height:innerHeight};
    const box=parent.getBoundingClientRect();
    return {left:box.left+parent.clientLeft,top:box.top+parent.clientTop,width:parent.clientWidth,height:parent.clientHeight};
  }
  function position(x,y) {
    const area=bounds(), box=root.getBoundingClientRect();
    const left=Math.max(8,Math.min(x,area.width-box.width-8));
    const top=Math.max(8,Math.min(y,area.height-box.height-8));
    userPosition={x:left,y:top};
    Object.assign(root.style,{left:`${left}px`,top:`${top}px`,right:'auto',bottom:'auto'});
  }
  function keepInBounds() {
    cancelAnimationFrame(positionFrame);
    positionFrame=requestAnimationFrame(()=>{if(!disposed&&userPosition)position(userPosition.x,userPosition.y);});
  }
  function render() {
    const c=label(), active=state==='tour', finished=state==='done', reading=state==='reading', stop=stops[index];
    root.dataset.state=state; root.classList.toggle('guide-reduced',reduced);
    root.hidden=state==='dismissed'; q('.guide-close').hidden=false; q('.guide-close').setAttribute('aria-label',c.close);
    q('.guide-eyebrow').innerHTML=active?(lang==='zh'?`<b>第 ${index+1} 站</b> / 6 · ${stop.label[lang]}`:`STOP <b>${String(index+1).padStart(2,'0')}</b> / 06 · ${stop.label[lang]}`):(lang==='zh'?'<b>CV 导览</b> · 6 站':'<b>CV TOUR</b> · 6 stops');
    q('.guide-sound').setAttribute('aria-pressed',String(sound));q('.guide-sound').setAttribute('aria-label',lang==='zh'?(sound?'关闭导游声音':'开启导游声音'):(sound?'Mute guide':'Unmute guide'));
    q('#guide-heading').textContent=active?stop.title[lang]:finished?c.done:c.welcome;
    q('.guide-description').textContent=active?stop.text[lang]:finished?c.doneText:c.hint;
    q('.guide-stops').hidden=!active;
    q('.guide-stops').setAttribute('aria-label',lang==='zh'?'导览站点':'Tour stops');
    q('.guide-stops').replaceChildren(...stops.map((s,i)=>{
      const button=document.createElement('button'); button.type='button';button.dataset.guide='stop';button.dataset.index=String(i);
      button.setAttribute('aria-label',s.label[lang]);button.setAttribute('aria-current',i===index?'step':'false');
      button.title=s.label[lang];return button;
    }));
    q('.guide-visit').hidden=!active; q('.guide-visit').textContent=`${c.visit} ↗`;
    q('.guide-back').hidden=state==='idle'||reading; q('.guide-back').disabled=active&&index===0;
    q('.guide-back').textContent=finished?c.bye:c.back;
    q('.guide-primary').textContent=reading?`${c.resume} →`:active?(index===stops.length-1?`${c.finish} ✓`:`${c.next} →`):finished?`${c.again} ↺`:`${c.start} →`;
    character.setAttribute('aria-label',reading?c.resume:state==='idle'?c.start:c.replay);
    const dragLabel=lang==='zh'?'拖动导游；也可用方向键移动，Home 键复位':'Move guide: drag or use arrow keys; Home resets';
    q('.guide-drag').setAttribute('aria-label',dragLabel);q('.guide-drag').title=dragLabel;
    character.title=lang==='zh'?'点击打招呼，拖动可移动':'Click to greet · drag to move';
    keepInBounds();onStateChange({state,index,lang,sound,reduced});
  }
  function animate(pose,{entrance=false}={}) {
    appearanceShown=true;
    clearTimeout(poseTimer);cancelAnimationFrame(poseFrame);delete root.dataset.pose;
    playSound({entrance});
    if(reduced) return;
    poseFrame=requestAnimationFrame(()=>{root.dataset.pose=pose;poseTimer=setTimeout(()=>{if(!disposed)delete root.dataset.pose;},pose==='walk'?760:1050);});
  }
  function stopAudio() { playbackRevision++;audio.pause();audio.currentTime=0; }
  function playSound({entrance=false}={}) {
    if(disposed||state==='dismissed'||!sound||document.hidden) return;
    autoplayPending=false;
    stopAudio();
    const revision=playbackRevision;
    audio.play().then(()=>{if(!disposed&&revision===playbackRevision)q('.guide-audio-status').textContent='';}).catch(error=>{
      if(disposed||!sound||revision!==playbackRevision)return;
      if(entrance&&error.name==='NotAllowedError'){
        autoplayPending=true;
        q('.guide-audio-status').textContent=lang==='zh'?'点击导游，听一声招呼。':'Click the guide to hear its hello.';
      }else q('.guide-audio-status').textContent=label().audioError;
    });
  }
  function showArrival() {
    const image=q('.guide-idle');
    if(!disposed&&state!=='dismissed'&&!appearanceShown&&!document.hidden&&image.complete&&image.naturalWidth>0)animate('greet',{entrance:true});
  }
  function start() {
    returnFocus=document.activeElement;state='tour';index=0;render();animate('greet');onStep(stops[index]);focus('[data-guide="next"]');
  }
  function close() {
    if(state!=='dismissed')suspendedState=state;
    state='dismissed';autoplayPending=false;stopAudio();
    clearTimeout(poseTimer);cancelAnimationFrame(poseFrame);cancelAnimationFrame(positionFrame);
    delete root.dataset.pose;q('.guide-audio-status').textContent='';
    if(drag){const {target,id}=drag;drag=null;if(target.hasPointerCapture(id))target.releasePointerCapture(id);}
    root.classList.remove('guide-dragging');render();
    if(returnFocus?.isConnected&&!root.contains(returnFocus))returnFocus.focus({preventScroll:true});
  }
  function show() {if(disposed||state!=='dismissed')return;state=suspendedState;render();animate('greet');focus('[data-guide="next"]');}
  function step(next) {index=Math.max(0,Math.min(stops.length-1,next));render();animate('walk');onStep(stops[index]);focus('[data-guide="next"]');}
  function finish() {state='done';render();animate('bow');onStep(null);focus('[data-guide="next"]');}
  function resume() {state='tour';render();animate('greet');onStep(stops[index]);focus('[data-guide="next"]');}
  root.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    const handle=event.target.closest('.guide-character,.guide-drag');
    if(!handle)return;
    const box=root.getBoundingClientRect(),area=bounds();
    drag={id:event.pointerId,target:handle,x:event.clientX,y:event.clientY,left:box.left-area.left,top:box.top-area.top,moved:false};
    handle.setPointerCapture(event.pointerId);
  },{signal:abort.signal});
  root.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<6)return;
    drag.moved=true;root.classList.add('guide-dragging');
    position(drag.left+dx,drag.top+dy);
    event.preventDefault();
  },{signal:abort.signal});
  function endDrag(event) {
    if(!drag||drag.id!==event.pointerId)return;
    suppressClick=drag.moved;
    const target=drag.target;drag=null;root.classList.remove('guide-dragging');
    if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);
    setTimeout(()=>{suppressClick=false;},0);
  }
  root.addEventListener('pointerup',endDrag,{signal:abort.signal});
  root.addEventListener('pointercancel',endDrag,{signal:abort.signal});
  root.addEventListener('lostpointercapture',endDrag,{signal:abort.signal});
  root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}}, {capture:true,signal:abort.signal});
  q('.guide-drag').addEventListener('keydown',event=>{
    const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
    if(event.key==='Home'){event.preventDefault();userPosition=null;for(const key of ['left','top','right','bottom'])root.style.removeProperty(key);}
    else if(delta){event.preventDefault();const box=root.getBoundingClientRect(),area=bounds();position(box.left-area.left+delta[0],box.top-area.top+delta[1]);}
  },{signal:abort.signal});
  const resizeObserver=new ResizeObserver(keepInBounds);
  resizeObserver.observe(root);if(root.offsetParent)resizeObserver.observe(root.offsetParent);
  root.addEventListener('click',event=>{
    const control=event.target.closest('[data-guide]');if(!control||!root.contains(control))return;
    switch(control.dataset.guide) {
      case 'actor': if(state==='reading')resume();else if(state==='idle')start();else animate('greet'); break;
      case 'next': if(state==='reading')resume();else if(state!=='tour')start();else if(index===stops.length-1)finish();else step(index+1); break;
      case 'back': if(state==='done')close();else if(index>0)step(index-1); break;
      case 'stop': step(Number(control.dataset.index));break;
      case 'close': close();break;
      case 'sound': sound=!sound;if(!sound){autoplayPending=false;stopAudio();q('.guide-audio-status').textContent='';}render();if(sound)playSound();break;
      case 'visit': state='reading';render();onVisit(stops[index]);animate('point');focus('[data-guide="next"]');break;
    }
  },{signal:abort.signal});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&state!=='dismissed'){event.preventDefault();event.stopPropagation();close();}},{signal:abort.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();else showArrival();},{signal:abort.signal});
  document.addEventListener('click',event=>{if(autoplayPending&&!root.contains(event.target))playSound();},{signal:abort.signal});
  const preferenceChange=event=>{reduced=event.matches;render();};
  motionPreference.addEventListener('change',preferenceChange,{signal:abort.signal});
  render();
  q('.guide-idle').addEventListener('load',showArrival,{once:true,signal:abort.signal});
  requestAnimationFrame(showArrival);
  return {
    start,close,show,toggle(){if(state==='dismissed')show();else close();},
    setLanguage(value){lang=value==='zh'?'zh':'en';render();},
    setSound(value,{preview=false}={}){sound=Boolean(value);if(!sound){autoplayPending=false;stopAudio();q('.guide-audio-status').textContent='';}else if(preview)playSound();return sound;},
    setReducedMotion(value){reduced=Boolean(value);clearTimeout(poseTimer);cancelAnimationFrame(poseFrame);delete root.dataset.pose;render();return reduced;},
    getState(){return {state,index,lang,sound,reduced};},
    destroy(){disposed=true;abort.abort();resizeObserver.disconnect();clearTimeout(poseTimer);cancelAnimationFrame(poseFrame);cancelAnimationFrame(positionFrame);stopAudio();root.replaceChildren();root.classList.remove('mascot-guide');}
  };
}
