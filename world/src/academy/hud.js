import {TRIALS,MEDALS} from './trials.js';

// DOM HUD for the lean Academy. Writes only when values change; per-frame work
// is limited to transforms on the ring marker and target reticle.

const TEXT={
  title:['Moonlit Trials','月夜试炼'],
  tagline:['Fly the Academy grounds. Thread the rings, chain the stardust, outfly the wisps.','在学院上空飞行：穿过光环、连收星尘、甩开游魂。'],
  play:['Start','开始'],free:['Free flight','自由飞行'],trials:['Trials','试炼'],
  locked:['Win a medal in the previous trial to unlock','在上一个试炼中获得奖牌即可解锁'],
  best:['Best','最佳'],noBest:['Not flown yet','尚未挑战'],
  retry:['Retry','重试'],next:['Next trial','下一个试炼'],
  rings:['Rings','光环'],stardust:['Stardust','星尘'],wisps:['Wisps','游魂'],timeBonus:['Time bonus','剩余时间'],total:['Score','得分'],
  outOfTime:['Out of time','时间到'],finished:['Trial complete','试炼完成'],newBest:['New best','新纪录'],
  medal:{bronze:['Bronze','铜牌'],silver:['Silver','银牌'],gold:['Gold','金牌']},
  go:['Go!','出发！'],perfect:['Perfect','完美'],chain:['Chain','连环'],banished:['Wisp banished','驱散游魂'],
  hit:['Hit','被击中'],combo:['Combo','连击'],lowTime:['Hurry!','快一点！'],
  gatePrompt:['Fly through the gate to start','穿过光门开始'],read:['Read','阅读'],
  hover:['Steer to fly','操纵方向即可起飞'],
  shard:['Star shard','星辰碎片'],discovered:['Discovered','发现'],
  turnBack:['Turning back toward the islands','正在掉头返回岛屿'],
  keys:[[['W S','Climb / dive'],['A D','Turn'],['Shift','Boost'],['Space','Cast'],['Q E','Roll'],['F','Read'],['T','Trials']],
        [['W S','爬升 / 俯冲'],['A D','转向'],['Shift','加速'],['空格','施法'],['Q E','翻滚'],['F','阅读'],['T','试炼']]],
  roll:['Roll','翻滚'],boost:['Boost','加速'],cast:['Cast','施法'],
  quality:['Graphics','画面'],
  touchHint:['Left stick: steer and climb · buttons: boost, cast, roll','左摇杆：转向与升降 · 按钮：加速、施法、翻滚'],
};
const fmtScore=n=>Math.round(n).toLocaleString('en-US');

export function createHud(container,{lang='en',onAction=()=>{}}={}){
  let L=lang==='zh'?1:0;
  const t=key=>{const v=TEXT[key];return Array.isArray(v)?v[L]:v;};
  const root=document.createElement('div');root.className='ac-hud';root.dataset.mode='free';
  root.innerHTML=`
  <div class="ac-top" aria-live="off">
    <div class="ac-chip ac-trial"><span class="ac-trial-name"></span><b class="ac-rings"></b></div>
    <div class="ac-timer"><b class="ac-time">0.0</b><span class="ac-time-pop"></span></div>
    <div class="ac-chip ac-score"><b class="ac-score-value">0</b><span class="ac-combo"><span class="ac-combo-x">×1</span><i><i class="ac-combo-bar"></i></i></span></div>
  </div>
  <div class="ac-center"><div class="ac-countdown" aria-live="assertive"></div><div class="ac-callouts"></div></div>
  <div class="ac-marker" hidden><span class="ac-marker-arrow"></span><span class="ac-marker-label"></span></div>
  <div class="ac-reticle" hidden></div>
  <div class="ac-bottom">
    <button class="ac-prompt" hidden></button>
    <div class="ac-meters"><div class="ac-boost" title=""><i class="ac-boost-fill"></i></div><div class="ac-roll"><i class="ac-roll-fill"></i></div></div>
    <div class="ac-keys"></div>
    <div class="ac-touch"><button data-ac="roll-left" aria-label="">⟲</button><button data-ac="cast" class="ac-touch-cast" aria-label=""></button><button data-ac="roll-right" aria-label="">⟳</button></div>
  </div>
  <div class="ac-toast" role="status" aria-live="polite"></div>
  <section class="ac-panel ac-intro" hidden></section>
  <section class="ac-panel ac-results" hidden></section>
  <section class="ac-panel ac-picker" hidden></section>`;
  container.appendChild(root);
  const $=s=>root.querySelector(s);
  const el={time:$('.ac-time'),pop:$('.ac-time-pop'),trialName:$('.ac-trial-name'),rings:$('.ac-rings'),score:$('.ac-score-value'),comboX:$('.ac-combo-x'),comboBar:$('.ac-combo-bar'),
    countdown:$('.ac-countdown'),callouts:$('.ac-callouts'),marker:$('.ac-marker'),markerLabel:$('.ac-marker-label'),markerArrow:$('.ac-marker-arrow'),reticle:$('.ac-reticle'),
    prompt:$('.ac-prompt'),boost:$('.ac-boost-fill'),roll:$('.ac-roll-fill'),keys:$('.ac-keys'),toast:$('.ac-toast'),intro:$('.ac-intro'),results:$('.ac-results'),picker:$('.ac-picker'),timer:$('.ac-timer')};
  const cache=new Map();
  const set=(node,key,value)=>{if(cache.get(key)!==value){cache.set(key,value);node.textContent=value;}};
  const style=(node,key,prop,value)=>{const k=key+prop;if(cache.get(k)!==value){cache.set(k,value);node.style[prop]=value;}};
  root.addEventListener('click',e=>{const b=e.target.closest('[data-ac]');if(!b)return;e.preventDefault();onAction(b.dataset.ac,b.dataset.id);});
  root.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-ac^="roll"],[data-ac="cast"]');if(!b)return;e.preventDefault();onAction(b.dataset.ac,null,{pointer:true});});
  let toastTimer=0;

  function renderKeys(){el.keys.innerHTML=TEXT.keys[L].map(([k,v])=>`<span><kbd>${k}</kbd>${v}</span>`).join('');
    root.querySelector('[data-ac="roll-left"]').setAttribute('aria-label',t('roll'));root.querySelector('[data-ac="roll-right"]').setAttribute('aria-label',t('roll'));
    root.querySelector('[data-ac="cast"]').setAttribute('aria-label',t('cast'));root.querySelector('[data-ac="cast"]').textContent=t('cast');}
  renderKeys();

  function medalBadge(medal){return medal?`<span class="ac-medal ac-medal-${medal}" title="${TEXT.medal[medal][L]}"></span>`:'<span class="ac-medal ac-medal-none"></span>';}
  function trialRow(trial,save,unlocked){
    const entry=save.trials[trial.id],open=unlocked.includes(trial.id);
    return `<button class="ac-trial-card" data-ac="trial" data-id="${trial.id}" ${open?'':'disabled'}>
      ${medalBadge(entry?.medal)}<span><b>${trial.name[L?'zh':'en']}</b><small>${open?trial.blurb[L?'zh':'en']:t('locked')}</small></span>
      <em>${entry?.best!=null?`${t('best')} ${fmtScore(entry.best)}`:t('noBest')}</em></button>`;
  }

  return {
    root,
    setLanguage(lang){L=lang==='zh'?1:0;cache.clear();renderKeys();},
    setMode(mode){if(root.dataset.mode!==mode)root.dataset.mode=mode;},
    showIntro(save,unlocked){
      el.intro.innerHTML=`<h2>${t('title')}</h2><p>${t('tagline')}</p><div class="ac-trial-list">${TRIALS.map(tr=>trialRow(tr,save,unlocked)).join('')}</div>
        <div class="ac-actions"><button class="ac-primary" data-ac="trial" data-id="${unlocked.at(-1)}">${t('play')} · ${TRIALS.find(x=>x.id===unlocked.at(-1)).name[L?'zh':'en']}</button><button data-ac="free">${t('free')}</button></div>
        <div class="ac-intro-keys">${TEXT.keys[L].map(([k,v])=>`<span><kbd>${k}</kbd>${v}</span>`).join('')}</div><p class="ac-touch-hint">${t('touchHint')}</p>`;
      el.intro.hidden=false;el.picker.hidden=true;el.results.hidden=true;
      el.intro.querySelector('.ac-primary')?.focus({preventScroll:true});
    },
    showPicker(save,unlocked){
      el.picker.innerHTML=`<h2>${t('trials')}</h2><div class="ac-trial-list">${TRIALS.map(tr=>trialRow(tr,save,unlocked)).join('')}</div><div class="ac-actions"><button data-ac="free">${t('free')}</button></div>`;
      el.picker.hidden=false;el.intro.hidden=true;el.results.hidden=true;
      el.picker.querySelector('.ac-trial-card:not([disabled])')?.focus({preventScroll:true});
    },
    hidePanels(){el.intro.hidden=el.picker.hidden=el.results.hidden=true;},
    get panelOpen(){return !el.intro.hidden||!el.picker.hidden||!el.results.hidden;},
    showResults(result,{newBest,trial,nextUnlocked}){
      const rows=[[t('rings'),`${result.rings} / ${result.totalRings}`],[t('stardust'),String(result.stardust)],[t('wisps'),String(result.wisps)],[t('timeBonus'),fmtScore(result.timeBonus)]];
      const medal=result.medal;
      el.results.innerHTML=`<p class="ac-eyebrow">${trial.name[L?'zh':'en']}</p><h2>${result.finished?(medal?TEXT.medal[medal][L]:t('finished')):t('outOfTime')}</h2>
        <div class="ac-result-medal">${medalBadge(medal)}</div>
        <div class="ac-total"><span>${t('total')}</span><b>${fmtScore(result.score)}</b>${newBest?`<em>${t('newBest')}</em>`:''}</div>
        <dl>${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <div class="ac-actions"><button class="ac-primary" data-ac="retry"><kbd>R</kbd>${t('retry')}</button>${nextUnlocked?`<button data-ac="trial" data-id="${nextUnlocked}"><kbd>N</kbd>${t('next')}</button>`:''}<button data-ac="free"><kbd>X</kbd>${t('free')}</button></div>`;
      el.results.hidden=false;el.intro.hidden=el.picker.hidden=true;
      el.results.querySelector('.ac-primary')?.focus({preventScroll:true});
    },
    trial(trial,run){
      set(el.trialName,'trialName',trial?trial.name[L?'zh':'en']:'');
      if(!run)return;
      set(el.rings,'rings',`${run.ring} / ${run.rings.length}`);
      const time=run.phase==='countdown'?trial.startTime:run.time;set(el.time,'time',time.toFixed(1));
      el.timer.classList.toggle('low',run.phase==='running'&&run.time<=5);
      set(el.score,'score',fmtScore(run.score));set(el.comboX,'combo',`×${run.combo}`);
      style(el.comboBar,'cb','transform',`scaleX(${(run.comboTimer/2.6).toFixed(3)})`);
    },
    countdown(value){set(el.countdown,'cd',value);el.countdown.classList.remove('pulse');void el.countdown.offsetWidth;if(value)el.countdown.classList.add('pulse');},
    timePop(text){el.pop.textContent=text;el.pop.classList.remove('show');void el.pop.offsetWidth;el.pop.classList.add('show');},
    callout(text,kind=''){
      const node=document.createElement('div');node.className=`ac-callout ${kind}`;node.textContent=text;el.callouts.appendChild(node);
      while(el.callouts.children.length>3)el.callouts.firstChild.remove();setTimeout(()=>node.remove(),1300);
    },
    toast(text,ms=2600){el.toast.textContent=text;el.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),ms);},
    meters(boost,rollReady,boosting){style(el.boost,'b','transform',`scaleX(${boost.toFixed(3)})`);el.boost.parentElement.classList.toggle('active',boosting);style(el.roll,'r','transform',`scaleX(${rollReady.toFixed(3)})`);},
    prompt(text,action){if(!text){if(!el.prompt.hidden)el.prompt.hidden=true;return;}el.prompt.hidden=false;set(el.prompt,'prompt',text);el.prompt.dataset.ac=action||'';},
    /** Screen-space marker. x,y in px; onScreen decides arrow vs diamond. */
    marker(visible,x,y,angle,label,onScreen){
      if(!visible){if(!el.marker.hidden)el.marker.hidden=true;return;}
      if(el.marker.hidden)el.marker.hidden=false;
      el.marker.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      el.marker.classList.toggle('edge',!onScreen);
      el.markerArrow.style.transform=onScreen?'':`rotate(${angle.toFixed(3)}rad)`;
      set(el.markerLabel,'ml',label);
    },
    reticle(visible,x,y){if(!visible){if(!el.reticle.hidden)el.reticle.hidden=true;return;}if(el.reticle.hidden)el.reticle.hidden=false;el.reticle.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;},
    t,
    dispose(){clearTimeout(toastTimer);root.remove();},
  };
}
export {MEDALS};
