import {locations,spellDefinitions,crystalPositions,ringPositions,spawn,worldBounds,islands,court,mapPoint} from './locations.js';
import {links,publications,cvForLanguage} from './content.js';
import {renderJournal,renderPaperDetail,renderProjectDetail,renderExhibitionHUD} from './journal.js';
import {getProject,getProjectMedia,selectedProjects} from './exhibition-content.js';
import {parseContentRoute,contentHash,ReadingMemory,clampMedia} from './exhibition-state.js';
import {freshProgress,achievements} from './logic.js';
import {cameraViews,tourStops} from './navigation.js';

const paths={
  book:'M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3ZM12 6v15',
  castle:'M3 21V10l3-3 3 3v3h6v-3l3-3 3 3v11ZM4 4v3M8 4v3M16 4v3M20 4v3M10 21v-5h4v5',
  spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM19 2v4M17 4h4',
  orbit:'M12 3a9 9 0 1 0 9 9M12 3v3M21 12h-3M5 19l14-14M9 12a3 3 0 0 0 3 3M19 2v5h5',
  compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5Z',
  feather:'M4 21 19 6M8 17l-1-7 8-7q7-2 6 5l-7 9Z M10 14h7',
  map:'m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3ZM8 2v17M16 5v17',
  arrow:'M4 12h15M13 5l7 7-7 7',
  close:'m6 6 12 12M6 18 18 6',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  sound:'M4 9h4l5-4v14l-5-4H4ZM17 8q5 4 0 8M20 5q7 7 0 14',
  mute:'M4 9h4l5-4v14l-5-4H4ZM17 9l5 6M17 15l5-6',
  portal:'M7 21a9 12 0 1 1 10 0M5 21h14M9 18a5 8 0 1 1 6 0M12 11v6M9 14l3 3 3-3',
  wand:'m4 20 12-12 3 3L7 23ZM17 2v4M21 6h-3M13 4l2 2M20 13l2 2M8 4v4M6 6h4',
  trophy:'M8 3h8v8a4 4 0 0 1-8 0ZM8 5H4v4a4 4 0 0 0 4 4M16 5h4v4a4 4 0 0 1-4 4M12 15v6M8 21h8',
  diamond:'m12 2 8 10-8 10-8-10ZM4 12h16M12 2v20',
  shield:'m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5ZM9 12l2 2 4-5',
  help:'M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3M12 17v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  chevron:'m8 5 7 7-7 7',
  up:'m6 15 6-6 6 6',
  down:'m6 9 6 6 6-6',
  exit:'M9 4H4v16h5M10 12h12M17 7l5 5-5 5',
  check:'m5 12 5 5L20 7',
};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
const copy={
  audioMuted:['Muted','已静音'],audioLoading:['Preparing music…','正在准备配乐…'],audioReady:['Music ready','配乐已就绪'],audioUnavailable:['Music could not load. You can retry.','配乐加载失败，可以重试。'],retry:['Retry','重试'],
  gameplay:['Optional play','可选玩法'],timeOfDay:['Time of day','时段'],auto:['Auto cycle','自动循环'],dawn:['Dawn','清晨'],day:['Day','白天'],dusk:['Dusk','黄昏'],night:['Moonlit night','明亮月夜'],musicVolume:['Music volume','音乐音量'],effectsVolume:['World sounds','环境与动作音量'],
  flightTools:['Explore tools','探索工具'],
  camera:['Camera','视角'],altitude:['Altitude','飞行高度'],altitudeUp:['Ascend 12 metres','上升 12 米'],altitudeDown:['Descend 12 metres','下降 12 米'],
  tour:['Guided tour','景观导览'],tourEnd:['End tour','结束导览'],tourNext:['Next stop','下一站'],tourPrev:['Previous stop','上一站'],tourRead:['Read more','了解更多'],
  lantern:['Release a lantern','放飞孔明灯'],flightTrial:['Flight trial','穿环挑战'],ctrlCamera:['Change camera view','切换视角'],

  portfolio:['Portfolio','个人资料'],map:['World map','世界地图'],traditional:['Traditional site','传统主页'],settings:['Settings','设置'],lang:['Language','语言'],sound:['Sound','声音'],
  eyebrow:['PERSONAL WEBSITE','个人网站'],hero:['Yaxin Luo','Yaxin Luo'],
  intro:['I’m a PhD student at MBZUAI, building native multimodal systems for agentic design and self-improving long-horizon harnesses. Welcome to my little world of ideas.','我在 MBZUAI 攻读博士，研究原生多模态系统、多模态智能体设计（multimodal agentic design）与长程 Harness 自迭代。欢迎来到这个由想法构成的小小世界。'],
  primary:['View portfolio','查看个人资料'],explore:['Take the broom','骑上扫把探索'],papers:['Publications','学术论文'],projects:['Projects','研究作品'],cv:['Download CV','下载简历'],
  name:['Yaxin Luo','Yaxin Luo'],role:['ML PHD STUDENT · MBZUAI','机器学习博士生 · MBZUAI'],
  footnote:['MULTIMODAL DESIGN · AGENTIC DESIGN','多模态设计 · 智能体设计'],hint:['No quests required. All my work is one click away.','无需完成任务，所有资料一点即达。'],
  sceneLabel:['THE GRAND ACADEMY','中央魔法学院'],sceneSub:['About me','关于我'],travel:['Cast a portkey','施展瞬移魔法'],
  loading:['Lighting the lanterns…','正在点亮灯火…'],ready:['YOUR WORLD IS READY','魔法世界已就绪'],error:['The 3D world couldn’t open here. My portfolio is still ready to read.','当前设备未能打开 3D 世界。你仍然可以完整查阅我的个人资料。'],
  journal:['Portfolio','个人资料'],journalSub:['RESEARCH & SELECTED WORK','研究与作品'],close:['Go back','返回'],
  explorationJournal:['Exploration','探索记录'],
  about:['About me','关于我'],publications:['Publications','学术论文'],research:['Research','研究方向'],journey:['Experience','经历'],contact:['Get in touch','联系我'],
  quests:['Side quests','探索小任务'],controls:['How to explore','探索指南'],visit:['Places discovered','已探索的地点'],stardust:['Stardust found','已收集的星尘'],
  ward:['Ward','护盾'],mana:['Magic','魔力'],interact:['Open','打开'],nearest:['Nearby','附近'],
  fly:['Fly','飞行'],boost:['Boost','加速'],cast:['Cast','施法'],ascend:['Ascend','上升'],descend:['Descend','下降'],
  rotate:['Right-drag to orbit · Scroll to zoom','右键拖动环绕 · 滚轮缩放'],
  mapTitle:['World map','世界地图'],mapIntro:['Pick a place to read its chapter or step through a portkey. Every destination is open from the start.','选择地点，直接阅读资料，或穿过传送门抵达那里。所有地点从一开始就已开放。'],
  read:['Read chapter','直接阅读'],teleport:['Teleport here','瞬移至此'],mapYou:['You are here','你在这里'],
  preferences:['Make yourself at home.','让探索更自在。'],quality:['Visual quality','画面质量'],qualityHelp:['High keeps detailed materials, sharper edges and rich shadows. Choose a lighter setting if needed; quality stays at your choice.','高画质保留材质细节、清晰边缘与丰富阴影。需要时可手动调低，探索过程中不会自动降画质。'],
  high:['High','高'],balanced:['Balanced','均衡'],low:['Lightweight','轻量'],motion:['Reduced motion','减少动态效果'],motionHelp:['Gentler camera transitions and fewer ambient animations.','减少镜头过渡和环境动画。'],
  audioHelp:['Music, atmosphere and interaction sounds. Audio starts only after you enable it.','音乐、环境与交互声音。由你开启后才会播放。'],on:['On','开启'],off:['Off','关闭'],
  reset:['Reset exploration progress','重置探索进度'],resetHelp:['Removes discoveries, stardust, banished wisps and your local best flight time.','清除本机的地点探索、星尘、驱散小怪数量与飞行最佳成绩。'],
  resetConfirm:['Reset my local progress','确认重置本机进度'],cancel:['Cancel','取消'],local:['Progress stays in this browser. No account needed.','进度仅保存在当前浏览器，无需账号。'],
  performance:['World performance','世界运行状态'],fps:['frames / sec','帧 / 秒'],
  questsTitle:['A little adventure, if you fancy.','如果愿意，来一场小冒险。'],questsIntro:['These are just for fun. Your visit never needs a score, and my portfolio is always open.','这些都是可选的小乐趣。访问本站不需要分数，所有个人资料始终开放。'],
  quest1:['The curious scholar','好奇的学者'],quest1desc:['Visit all six places in the academy. Portkeys count, too.','探访学院的六个地点。使用瞬移也可以。'],
  quest2:['A pocketful of stars','装满星光的口袋'],quest2desc:['Find eight floating stardust crystals around the grounds.','寻找散落在世界中的八枚悬浮星尘。'],
  quest3:['Keeper of the grounds','学院的守护者'],quest3desc:['Banish five wandering wisps with your favorite spell.','用你喜欢的咒语驱散五只游荡的小幽灵。'],
  quest4:['On borrowed wings','借风而行'],quest4desc:['Fly through ten rings, in order, within two minutes.','在两分钟内按顺序穿过十个光环。'],
  raceStart:['Begin the flight trial','开始穿环挑战'],raceCancel:['End flight trial','结束穿环挑战'],best:['Personal best','个人最佳'],complete:['Complete','已完成'],
  spellGuide:['A few useful spells','几种实用咒语'],spellGuideDesc:['Spells gently aim at nearby wisps in front of you. Magic replenishes on its own. Press Q for a protective ward. Wisps stay peaceful until you cast a spell.','咒语会辅助瞄准前方附近的小幽灵。魔力会自动恢复。按 Q 可开启防护罩。主动施法前，小幽灵不会攻击你。'],
  controlTitle:['Your first flying lesson.','你的第一堂飞行课。'],controlIntro:['Explore at your own pace, or open the map and teleport anywhere.','按自己的节奏探索，也可以打开地图瞬移至任意地点。'],
  ctrlFlight:['Move the broom','移动扫把'],ctrlAltitude:['Rise / descend','上升 / 下降'],ctrlSpell:['Cast selected spell','释放当前咒语'],ctrlChoose:['Choose a spell','选择咒语'],ctrlShield:['Protego shield','盔甲护身'],ctrlInteract:['Read nearby chapter','阅读附近地点的资料'],ctrlMenu:['Open / close the grimoire','打开 / 关闭手记'],ctrlMap:['Open the map','打开地图'],
  mobileHelp:['On touchscreens, use the left thumbstick to fly and the buttons on the right to cast, rise and descend. Tap any map destination for an instant portkey.','在触屏设备上，使用左侧摇杆飞行、右侧按钮施法和升降。轻点地图上的目的地即可瞬移。'],
  breathe:['Take a breath. Your world can wait.','歇一会儿，世界会等你。'],paused:['Paused','已暂停'],resume:['Resume exploring','继续探索'],
  noGame:['Read portfolio instead','查看个人资料'],chapter:['CHAPTER','篇章'],allOpen:['ALL CHAPTERS OPEN','所有篇章均已开放'],
};

function readPrefs(){
  let p={};try{p=JSON.parse(localStorage.getItem('yaxin.grimoire.preferences')||'{}');}catch{}
  if(!p||typeof p!=='object')p={};
  const volume=(v,fallback)=>typeof v==='number'?Math.max(0,Math.min(1,v)):fallback;
  return {lang:['en','zh'].includes(p.lang)?p.lang:'en',quality:['high','balanced','low'].includes(p.quality)?p.quality:'high',reducedMotion:typeof p.reducedMotion==='boolean'?p.reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,sound:p.sound===true,timeOfDay:['auto','dawn','day','dusk','night'].includes(p.timeOfDay)?p.timeOfDay:'auto',musicVolume:volume(p.musicVolume,.5),effectsVolume:volume(p.effectsVolume,.65),gameplay:p.gameplay===true};
}

export class Interface {
  constructor(root){
    this.root=root;this.options=readPrefs();const lang=new URLSearchParams(location.search).get('lang');if(['en','zh'].includes(lang))this.options.lang=lang;
    this.game=null;this.view=null;this.lastSection='about';this.lastFocus=null;this.ready=false;this.failed=false;this.resetConfirm=false;this.snapshot={progress:freshProgress(),mana:100,health:100,spell:0,position:{...spawn},race:null};
    this.t=key=>copy[key]?.[this.options.lang==='zh'?1:0]??key;
    this.readingMemory=new ReadingMemory();this.entity=null;this.exhibition=null;this.route=null;this.historyDepth=history.state?.portfolio?.depth||0;
    this.render();this.bind();this.applyLanguage();
    const initial=parseContentRoute(location.hash);if(initial)this.showRoute(initial,{history:'replace',origin:history.state?.portfolio?.exhibitionOrigin});
  }
  persist(){try{localStorage.setItem('yaxin.grimoire.preferences',JSON.stringify(this.options));}catch{/* Preferences remain usable without storage. */}}
  render(){const t=this.t;
    this.root.innerHTML=`<main class="experience" id="experience">
      <div class="cover-art" aria-hidden="true"></div><canvas id="world" tabindex="0" aria-label="${this.options.lang==='zh'?'扫把飞行魔法世界':'Magical broom flight world'}"></canvas><div class="world-vignette" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div>
      <a class="skip-link" href="#portfolio" data-action="section" data-id="about">${t('portfolio')}</a>
      <header class="topbar"><a href="#" class="brand" data-action="home" aria-label="Yaxin Luo"><img src="/crest.svg" alt=""/><span>YAXIN LUO<small>PORTFOLIO</small></span></a>
      <nav class="header-nav" aria-label="${t('portfolio')}"><button class="nav-link" data-action="section" data-id="projects"><span data-i18n="projects">${t('projects')}</span></button><button class="nav-link" data-action="section" data-id="publications"><span data-i18n="papers">${t('papers')}</span></button><a class="nav-link persistent-cv" href="${cvForLanguage(this.options.lang)}" target="_blank" rel="noopener noreferrer">CV <span class="nav-pdf">PDF ↗</span></a><button class="nav-link persistent-contact" data-action="section" data-id="contact"><span data-i18n="contact">${t('contact')}</span></button></nav>
      <div class="utilities"><button class="icon-button utility-map" data-action="map" aria-label="${t('map')}">${icon('map')}</button><button class="icon-button sound-button" data-action="sound" aria-label="${t('sound')}">${icon(this.options.sound?'sound':'mute')}</button><button class="language-button" data-action="language" aria-label="Switch language / 切换语言"><span class="lang-en">EN</span><i>/</i><span class="lang-zh">中</span></button><button class="icon-button settings-button" data-action="settings" aria-label="${t('settings')}">${icon('settings')}</button></div></header>
      <section class="welcome"><div class="eyebrow"><span></span><span data-i18n="eyebrow">${t('eyebrow')}</span></div><h1 data-i18n-html="hero">${t('hero')}</h1><div class="hero-person"><small data-i18n="role">${t('role')}</small></div><p class="hero-intro" data-i18n="intro">${t('intro')}</p><div class="welcome-actions"><button class="button primary" data-action="section" data-id="about">${icon('book')}<span data-i18n="primary">${t('primary')}</span>${icon('arrow')}</button><button class="button ghost" id="explore-button" data-action="start">${icon('wand')}<span data-i18n="explore">${t('explore')}</span></button></div><div class="quick-links"><button data-action="section" data-id="publications" data-i18n="papers">${t('papers')}</button><span>·</span><button data-action="section" data-id="projects" data-i18n="projects">${t('projects')}</button><span>·</span><a href="${cvForLanguage(this.options.lang)}" target="_blank" rel="noopener noreferrer" data-i18n="cv">${t('cv')}</a></div><p class="no-gate" data-i18n="hint">${t('hint')}</p></section>
      <div class="arrival-card"><span class="arrival-number">I</span><div><span class="small-label" data-i18n="sceneLabel">${t('sceneLabel')}</span><p data-i18n="sceneSub">${t('sceneSub')}</p><button data-action="travel" data-id="about">${icon('portal')}<span data-i18n="travel">${t('travel')}</span>${icon('arrow')}</button></div></div>
      <div id="landmark-labels" class="landmark-labels" aria-hidden="true"></div>
      <footer class="intro-footer"><span><i class="status-dot"></i><span id="load-status">${t('loading')}</span></span><span data-i18n="footnote">${t('footnote')}</span><span>01 <i>—</i> 06</span></footer>
      <div class="game-interface" hidden><button class="optional-play-toggle" data-action="gameplay" aria-pressed="${this.options.gameplay}">${icon('spark')}<span data-i18n="gameplay">${t('gameplay')}</span></button>
        <aside class="flight-tools" aria-label="${t('camera')}"><button class="flight-tools-toggle" data-action="flight-tools" aria-expanded="false"><span data-i18n="flightTools">${t('flightTools')}</span>${icon('chevron')}</button><div class="view-heading"><span data-i18n="camera">${t('camera')}</span><kbd>V</kbd></div><div class="camera-presets">${Object.entries(cameraViews).map(([id,p])=>`<button data-action="camera" data-id="${id}" aria-pressed="${id==='follow'}">${p.label[this.options.lang]}</button>`).join('')}</div><div class="altimeter"><button data-action="altitude" data-id="-12" aria-label="${t('altitudeDown')}">${icon('down')}<kbd>F</kbd></button><div><small data-i18n="altitude">${t('altitude')}</small><output id="altitude-value">18 <small>m</small></output><span class="altitude-track"><i id="altitude-fill"></i></span></div><button data-action="altitude" data-id="12" aria-label="${t('altitudeUp')}">${icon('up')}<kbd>R</kbd></button></div><div class="world-actions"><button data-action="tour" data-id="0">${icon('compass')}<span data-i18n="tour">${t('tour')}</span></button><button data-action="lantern">${icon('sun')}<span data-i18n="lantern">${t('lantern')}</span></button><button data-action="start-race">${icon('trophy')}<span data-i18n="flightTrial">${t('flightTrial')}</span></button></div></aside>
        <aside class="tour-card" hidden><div class="tour-heading"><span data-i18n="tour">${t('tour')}</span><b id="tour-count">01 / 06</b><button data-action="tour-end" aria-label="${t('tourEnd')}">${icon('close')}</button></div><h2 id="tour-title"></h2><p id="tour-description"></p><button class="tour-read" data-action="tour-read"><span data-i18n="tourRead">${t('tourRead')}</span>${icon('arrow')}</button><div class="tour-navigation"><button data-action="tour-prev" aria-label="${t('tourPrev')}">${icon('chevron')}</button><button data-action="tour-next"><span data-i18n="tourNext">${t('tourNext')}</span>${icon('arrow')}</button></div></aside>
        <aside class="quest-tracker"><button data-action="quests"><span class="small-label" data-i18n="explorationJournal">${t('explorationJournal')}</span>${icon('chevron')}</button><div>${icon('compass')}<span data-i18n="visit">${t('visit')}</span><b id="discovery-count">0 / 6</b></div><div>${icon('diamond')}<span data-i18n="stardust">${t('stardust')}</span><b id="crystal-count">0 / 8</b></div></aside>
        <nav class="location-dock" aria-label="${t('portfolio')}">${locations.map(l=>`<button data-action="section" data-id="${l.id}" aria-label="${t(l.id)}">${icon(l.icon)}<span>${t(l.id)}</span></button>`).join('')}</nav>
        <div class="race-hud" hidden><span>${icon('trophy')}<span data-i18n="quest4">${t('quest4')}</span></span><b id="race-progress">0 / 10</b><strong id="race-time">120.0</strong><button data-action="end-race" aria-label="${t('raceCancel')}">${icon('close')}</button></div>
        <div class="minimap-wrap"><button class="minimap-button" data-action="map" aria-label="${t('map')}">${this.mapSVG(true)}<span>${t('map')} <kbd>M</kbd></span></button></div>
        <div class="interaction-prompt" hidden><button data-action="interact"><kbd>E</kbd><span><small id="nearby-name"></small><strong data-i18n="interact">${t('interact')}</strong></span>${icon('book')}</button></div>
        <div class="flight-hud"><div class="vitals"><div><span>${icon('shield')}<span data-i18n="ward">${t('ward')}</span></span><i><i id="health-fill"></i></i><b id="health-value">100</b></div><div><span>${icon('spark')}<span data-i18n="mana">${t('mana')}</span></span><i><i id="mana-fill"></i></i><b id="mana-value">100</b></div></div><div class="spellbar">${spellDefinitions.map((s,i)=>`<button data-action="spell" data-id="${i}" class="spell-button ${i===0?'selected':''}" aria-label="${s.name[this.options.lang]}" aria-pressed="${i===0}"><kbd>${i+1}</kbd><span class="spell-glyph" style="--spell:${s.color}">${icon(i===0?'spark':i===1?'sun':'wand')}</span><span>${s.name[this.options.lang]}</span></button>`).join('')}<button class="shield-button" data-action="shield" aria-label="${t('ctrlShield')}"><kbd>Q</kbd>${icon('shield')}</button></div><div class="controls-hint"><span><kbd>W A S D</kbd> ${t('fly')}</span><span><kbd>SHIFT</kbd> ${t('boost')}</span><span><kbd>SPACE</kbd> ${t('cast')}</span><button data-action="controls">${icon('help')}</button></div></div>
        <div class="touch-controls"><div id="thumbstick" role="group" aria-label="${t('ctrlFlight')}"><div class="stick-cross"></div><div class="stick-knob"></div></div><div class="touch-actions"><button class="touch-altitude" data-control="up" aria-label="${t('ascend')}">${icon('up')}</button><button class="touch-fire" data-control="fire" aria-label="${t('cast')}">${icon('wand')}</button><button class="touch-altitude" data-control="down" aria-label="${t('descend')}">${icon('down')}</button><button class="touch-boost" data-control="boost">${t('boost')}</button></div></div>
      </div>
      <section class="exhibition-overlay" aria-labelledby="exhibition-title" hidden></section><div class="media-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer / 图片查看器" hidden></div>
      <div class="portal-transition" aria-hidden="true"><div></div><span id="portal-destination"></span></div>
      <div class="toast" role="status" aria-live="polite"></div>
      <div class="modal-backdrop" id="portfolio" hidden><section class="grimoire" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><aside class="grimoire-rail"><div class="book-mark">${icon('book')}<span data-i18n="journal">${t('journal')}</span><small data-i18n="journalSub">${t('journalSub')}</small></div><nav class="chapter-nav" aria-label="${t('journal')}">${locations.map(l=>`<button data-action="section" data-id="${l.id}"><span class="roman">${l.number}</span><span>${t(l.id)}</span>${icon('chevron')}</button>`).join('')}</nav><div class="rail-tools"><button data-action="map">${icon('map')}${t('map')}</button><button data-action="quests">${icon('spark')}${t('quests')}</button><button data-action="controls">${icon('help')}${t('controls')}</button><button data-action="settings">${icon('settings')}${t('settings')}</button></div><a class="rail-traditional" href="/traditional/">${t('traditional')}${icon('exit')}</a><small class="rail-foot">YAXIN LUO · MMXXVI</small></aside><div class="grimoire-pages"><header class="page-header"><span id="dialog-title"></span><div class="page-tools"><a class="modal-cv" href="${cvForLanguage(this.options.lang)}" target="_blank" rel="noopener noreferrer">CV ↗</a><button class="modal-contact" data-action="section" data-id="contact" data-i18n="contact">${t('contact')}</button><button class="modal-language" data-action="language" aria-label="Switch language / 切换语言">${this.options.lang==='en'?'中文':'EN'}</button><button class="modal-tool" data-action="map" aria-label="${t('map')}">${icon('map')}</button><button class="modal-tool" data-action="settings" aria-label="${t('settings')}">${icon('settings')}</button><button class="modal-tool" data-action="controls" aria-label="${t('controls')}">${icon('help')}</button><button class="close-button" data-action="close" aria-label="${t('close')}"><span>ESC</span>${icon('close')}</button></div></header><div class="page-content" id="page-content"></div></div></section></div>
    </main>`;
    this.canvas=this.root.querySelector('#world');
  }
  setGame(game){this.game=game;if(this.pendingExhibition){const pending=this.pendingExhibition;this.pendingExhibition=null;this.openExhibition(pending.id,{mediaIndex:pending.mediaIndex,history:'replace',returnOrigin:pending.returnOrigin});}}
  loaded(){this.ready=true;document.querySelector('.experience').classList.add('world-ready');this.updateStatus();}
  fail(error){this.failed=true;this.pendingExhibition=null;if(this.exhibition){const id=this.exhibition.projectId;this.removeExhibition();this.openProject(id,{history:'replace'});}document.querySelector('.experience').classList.add('world-failed');this.updateStatus();this.toast({en:copy.error[0],zh:copy.error[1]},9000);console.error('World initialization failed:',error);}
  updateStatus(){document.querySelector('#load-status').textContent=this.failed?this.t('error'):this.ready?this.t('ready'):this.t('loading');}
  bind(){
    this.root.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();this.action(b.dataset.action,b.dataset.id);});
    this.root.addEventListener('change',e=>{if(e.target.matches('[data-project-select]')){this.openExhibition(e.target.value);return;}const key=e.target.dataset.option;if(!key)return;this.options[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;this.persist();this.game?.setOption(key,this.options[key]);this.syncOptions();});
    this.root.addEventListener('input',e=>{if(e.target.matches('input[type=range][data-option]')){const key=e.target.dataset.option;this.options[key]=Number(e.target.value);this.game?.setOption(key,this.options[key]);const output=e.target.closest('.volume-control')?.querySelector('output');if(output)output.textContent=`${Math.round(this.options[key]*100)}%`;}});
    this.root.addEventListener('error',e=>{if(e.target.matches?.('.media-image-button img,.media-lightbox img')){e.target.closest('figure')?.classList.add('media-failed');}},true);
    window.addEventListener('popstate',e=>{this.historyDepth=e.state?.portfolio?.depth||0;this.showRoute(parseContentRoute(location.hash),{history:'none',backdrop:e.state?.portfolio?.backdrop,origin:e.state?.portfolio?.exhibitionOrigin});});
    window.addEventListener('hashchange',()=>{if(contentHash(parseContentRoute(location.hash))!==contentHash(this.route))this.showRoute(parseContentRoute(location.hash),{history:'none'});});
    window.addEventListener('keydown',e=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.lightboxOpen||this.view||this.exhibition?this.close():this.open(this.lastSection);return;}
      if(e.target.closest('[data-media-controls]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.setExhibitMedia(this.activeMediaIndex()+(e.key==='ArrowRight'?1:-1));}
      if(this.lightboxOpen&&e.key==='Tab'){this.trapFocus(e);return;}
      if(!e.target.matches('input,select,textarea')&&e.code==='KeyM'){e.preventDefault();this.view==='map'?this.close():this.open('map');}
      if(this.view&&e.key==='Tab')this.trapFocus(e);
    });
    this.root.querySelector('#page-content').addEventListener('scroll',()=>{clearTimeout(this.readScrollTimer);this.readScrollTimer=setTimeout(()=>this.saveReading(),140);});
    window.addEventListener('pagehide',()=>this.saveReading());
    const backdrop=this.root.querySelector('.modal-backdrop');backdrop.addEventListener('click',e=>{if(e.target===backdrop)this.close();});
    const stick=this.root.querySelector('#thumbstick'),knob=stick.querySelector('.stick-knob');let pointer=null;
    const move=e=>{if(e.pointerId!==pointer)return;const r=stick.getBoundingClientRect(),dx=(e.clientX-r.x-r.width/2)/(r.width*.32),dy=(e.clientY-r.y-r.height/2)/(r.height*.32),n=Math.max(1,Math.hypot(dx,dy));this.game?.setTouch(dx/n,dy/n);knob.style.transform=`translate(${dx/n*30}px,${dy/n*30}px)`;};
    stick.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);move(e);});stick.addEventListener('pointermove',move);
    const release=()=>{pointer=null;this.game?.setTouch(0,0);knob.style.transform='';};stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);
    this.root.querySelectorAll('[data-control]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.game?.setControl(b.dataset.control,true);b.classList.add('held');});const reset=()=>{this.game?.setControl(b.dataset.control,false);b.classList.remove('held');};b.addEventListener('pointerup',reset);b.addEventListener('pointercancel',reset);b.addEventListener('lostpointercapture',reset);});
  }
  action(action,id){
    if(action==='section')this.open(id);
    if(action==='paper')this.openPaper(id);
    if(action==='project')this.openProject(id);
    if(action==='exhibition')this.openExhibition(id);
    if(action==='exhibition-close')this.closeExhibition();
    if(action==='project-prev'||action==='project-next'){const current=this.exhibition?.projectId||this.entity?.id;const at=selectedProjects.findIndex(p=>p.id===current),step=action==='project-next'?1:-1;this.openExhibition(selectedProjects[(at+step+selectedProjects.length)%selectedProjects.length].id);}
    if(action==='media-prev'||action==='media-next')this.setExhibitMedia(this.activeMediaIndex()+(action==='media-next'?1:-1));
    if(action==='media-select')this.setExhibitMedia(Number(id));
    if(action==='media-enlarge')this.enlargeMedia();
    if(action==='media-close')this.closeMedia();
    if(action==='copy-email')this.copyText(links.email.replace(/^mailto:/,''),{en:'Email address copied',zh:'邮箱地址已复制'});
    if(action==='share-content')this.copyText(location.href,{en:'Link copied',zh:'链接已复制'});
    if(action==='gameplay'){this.options.gameplay=!this.options.gameplay;this.persist();this.game?.setOption('gameplay',this.options.gameplay);this.syncOptions();}
    if(['map','settings','quests','controls'].includes(action))this.open(action);
    if(action==='close')this.close();
    if(action==='home'){this.close({history:'replace',all:true});this.game?.returnHome?.();this.syncStarted(false);}
    if(action==='audio-retry'){this.options.sound=true;this.persist();this.game?.setOption('sound',true);this.syncOptions();}
    if(action==='start'){if(!this.game){this.toast({en:'The world is still preparing. You can read my portfolio now.',zh:'世界仍在准备中，你可以先阅读个人资料。'});return;}this.close({history:'replace',all:true});this.game.start();this.playing();this.toast({en:'WASD to fly · R / F to rise / descend · M for instant portkeys',zh:'WASD 飞行 · R / F 升降 · M 打开瞬移地图'},6500);}
    if(action==='flight-tools'){const panel=this.root.querySelector('.flight-tools');const expanded=panel.classList.toggle('expanded');panel.querySelector('.flight-tools-toggle').setAttribute('aria-expanded',String(expanded));}
    if(action==='camera')this.game?.setCameraView(id);
    if(action==='altitude')this.game?.changeAltitude(Number(id));
    if(action==='lantern')this.game?.releaseLantern();
    if(action==='tour'){if(this.game){this.close({history:'replace',all:true});this.playing();this.game.tourStop(Number(id)||0);}else this.toast({en:'The world is still preparing. All chapters are ready to read.',zh:'世界仍在准备中，所有资料均可直接阅读。'});}
    if(action==='tour-next'){const index=this.snapshot.tour?.index??0;if(index===tourStops.length-1)this.game?.endTour();else this.game?.tourStop(index+1);}
    if(action==='tour-prev')this.game?.tourStop(Math.max(0,(this.snapshot.tour?.index??0)-1));
    if(action==='tour-end')this.game?.endTour();
    if(action==='tour-read')this.open(tourStops[this.snapshot.tour?.index??0].id);
    if(action==='travel')this.travel(id);
    if(action==='language')this.toggleLanguage();
    if(action==='sound'){this.options.sound=!this.options.sound;this.persist();this.game?.setOption('sound',this.options.sound);this.root.querySelector('.sound-button').innerHTML=icon(this.options.sound?'sound':'mute');}
    if(action==='spell')this.game?.selectSpell(Number(id));
    if(action==='shield')this.game?.activateShield();
    if(action==='interact')this.game?.interact?.();
    if(action==='start-race'){if(this.game){this.close({history:'replace',all:true});this.options.gameplay=true;this.persist();this.game?.setOption('gameplay',true);this.syncOptions();this.game.startRace();this.playing();}else{this.toast({en:'The 3D world is not available yet. All portfolio chapters are open.',zh:'3D 世界暂不可用，所有个人资料仍然可以阅读。'});}}
    if(action==='end-race'){this.game?.cancelRace();if(this.view)this.open(this.view);}
    if(action==='reset'){this.resetConfirm=true;this.open('settings');}
    if(action==='cancel-reset'){this.resetConfirm=false;this.open('settings');}
    if(action==='confirm-reset'){this.game?.resetProgress();this.resetConfirm=false;this.open('settings');}
  }
  playing(){this.root.querySelector('.experience').classList.add('playing');this.root.querySelector('.game-interface').hidden=false;this.root.querySelectorAll('.welcome,.arrival-card,.intro-footer').forEach(el=>{el.inert=true;el.setAttribute('aria-hidden','true');});if(!this.view)this.canvas.focus({preventScroll:true});}
  syncStarted(started){
    const experience=this.root.querySelector('.experience');
    if(started){if(!experience.classList.contains('playing'))this.playing();return;}
    if(!experience.classList.contains('playing'))return;
    experience.classList.remove('playing');this.root.querySelector('.game-interface').hidden=true;
    this.root.querySelectorAll('.welcome,.arrival-card,.intro-footer').forEach(el=>{el.inert=!!this.view;el.setAttribute('aria-hidden',String(!!this.view));});
  }
  applyTimeMode(mode){
    if(!['auto','dawn','day','dusk','night'].includes(mode))return false;
    this.options.timeOfDay=mode;this.persist();const select=this.root.querySelector('[data-option="timeOfDay"]');if(select)select.value=mode;this.root.querySelector('.experience').dataset.timeOfDay=mode;return true;
  }
  audioStatusText(audio=this.snapshot.audio){return this.t(!audio?.enabled?'audioMuted':audio.status==='ready'?'audioReady':audio.status==='unavailable'?'audioUnavailable':'audioLoading');}
  travel(id){if(!this.game){this.open(id);return;}this.close({history:'replace',all:true});this.playing();this.game.travel(id);this.flash(id);}
  flash(id){if(this.options.reducedMotion)return;const l=locations.find(l=>l.id===id);if(!l)return;const el=this.root.querySelector('.portal-transition');el.classList.remove('active');this.root.querySelector('#portal-destination').textContent=l.name[this.options.lang];requestAnimationFrame(()=>el.classList.add('active'));clearTimeout(this.flashTimer);this.flashTimer=setTimeout(()=>el.classList.remove('active'),1100);}
  saveReading(){
    if(!this.view)return;const kind=this.entity?.kind||'section',id=this.entity?.id||this.view;
    this.readingMemory.save(kind,id,{scrollTop:this.root.querySelector('#page-content').scrollTop});
  }
  writeRoute(route,mode='push'){
    this.route=route;if(mode==='none')return;
    const hash=contentHash(route),url=`${location.pathname}${location.search}${hash}`;
    if(mode==='push'&&location.hash!==hash){this.historyDepth++;history.pushState({portfolio:{depth:this.historyDepth,backdrop:this.exhibition&&!route?.spatial?{...this.exhibition}:null,exhibitionOrigin:this.exhibitionReturn||null}},'',url);}
    else history.replaceState({portfolio:{depth:this.historyDepth,backdrop:this.exhibition&&!route?.spatial?{...this.exhibition}:null,exhibitionOrigin:this.exhibitionReturn||null}},'',url);
  }
  showRoute(route,{history:mode='none',backdrop=null,origin=null}={}){
    this.exhibitionClosing=false;this.closeMedia();
    if(!route){this.close({history:'none',all:true});this.restoreReturnFocus();return;}
    if(route.kind==='project'&&route.spatial){this.openExhibition(route.id,{mediaIndex:route.mediaIndex,history:mode,returnOrigin:origin});return;}
    if(this.exhibition&&!backdrop)this.removeExhibition();
    if(backdrop&&!this.exhibition&&this.game){this.exhibitionReturn=origin;this.exhibition={...backdrop};this.game.enterExhibit?.(backdrop.projectId,{mediaIndex:backdrop.mediaIndex,source:'history'});}
    if(route.kind==='paper')this.openPaper(route.id,{history:mode});
    else if(route.kind==='project')this.openProject(route.id,{mediaIndex:route.mediaIndex,history:mode});
    else this.open(route.id,{history:mode});
    this.restoreReturnFocus();
  }
  open(view,{history:mode='push',entity=null,focus=true}={}){
    this.pendingExhibition=null;this.saveReading();if(!this.view)this.lastFocus=document.activeElement;
    this.paperId=entity?.kind==='paper'?entity.id:null;this.entity=entity;this.view=view;if(locations.some(l=>l.id===view))this.lastSection=view;
    this.game?.setPaused(true);this.root.querySelector('.modal-backdrop').hidden=false;this.root.querySelector('.exhibition-overlay').hidden=true;this.setIsolation(true);this.root.querySelector('.experience').classList.add('reading');
    this.root.querySelectorAll('.chapter-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.id===view);b.setAttribute('aria-current',b.dataset.id===view?'page':'false');});
    this.root.querySelector('#dialog-title').textContent=this.t(view);
    const body=this.root.querySelector('#page-content'),saved=this.readingMemory.read(entity?.kind||'section',entity?.id||view);
    body.innerHTML=entity?.kind==='paper'?renderPaperDetail(entity.id,this.options.lang):entity?.kind==='project'?renderProjectDetail(entity.id,this.options.lang,saved.mediaIndex):locations.some(l=>l.id===view)?renderJournal(view,this.options.lang,this.snapshot.progress):view==='map'?this.mapContent():view==='quests'?this.questsContent():view==='settings'?this.settingsContent():this.controlsContent();body.scrollTop=saved.scrollTop;
    if(focus)(body.querySelector('#entity-title')||this.root.querySelector('.close-button')).focus({preventScroll:true});
    this.writeRoute(entity?{...entity,...(entity.kind==='project'?{mediaIndex:saved.mediaIndex,spatial:false}:{})}:{kind:'section',id:view},mode);
  }
  openPaper(id,options={}){if(!publications.some(p=>p.id===id)){this.open('publications',options);return;}this.open('publications',{...options,entity:{kind:'paper',id}});}
  openProject(id,{mediaIndex,history:mode='push',focus=true,section}={}){
    if(!getProject(id)){this.open('projects',{history:mode});return;}
    if(mediaIndex!==undefined)this.readingMemory.save('project',id,{mediaIndex});
    this.open('projects',{history:mode,entity:{kind:'project',id},focus});
    if(['method','role'].includes(section)){
      const target=this.root.querySelector(`[data-project-section="${section}"]`);
      if(target){target.tabIndex=-1;target.scrollIntoView({block:'start',behavior:'instant'});if(focus)target.focus({preventScroll:true});}
    }
  }
  openExhibition(id,{mediaIndex,history:mode='push',returnOrigin=null}={}){
    if(!getProject(id)){this.open('projects',{history:mode});return;}
    if(mediaIndex!==undefined)this.readingMemory.save('project',id,{mediaIndex});
    const index=this.readingMemory.read('project',id).mediaIndex,focused=document.activeElement;
    const origin=returnOrigin||this.exhibitionReturn||{route:this.route&&!this.route.spatial?{...this.route}:null,depth:this.historyDepth,focus:focused?.dataset?.action?{action:focused.dataset.action,id:focused.dataset.id||''}:null};
    if(!this.game?.enterExhibit||this.failed){this.openProject(id,{history:mode});this.pendingExhibition=this.failed?null:{id,mediaIndex:index,returnOrigin:origin};return;}
    this.saveReading();if(!this.exhibition){this.exhibitionFocus=document.activeElement;this.exhibitionReturn=origin;}
    this.exhibition={projectId:id,mediaIndex:index};this.entity=null;this.paperId=null;this.view=null;
    this.root.querySelector('.modal-backdrop').hidden=true;this.setIsolation(false);this.root.querySelector('.experience').classList.remove('reading');this.root.querySelector('.experience').classList.add('exhibiting');
    this.game.enterExhibit(id,{mediaIndex:index,source:'ui'});this.renderExhibition();this.playing();
    this.root.querySelector('#exhibition-title')?.focus({preventScroll:true});this.writeRoute({kind:'project',id,mediaIndex:index,spatial:true},mode);
  }
  renderExhibition(){if(!this.exhibition)return;const panel=this.root.querySelector('.exhibition-overlay');panel.innerHTML=renderExhibitionHUD(this.exhibition.projectId,this.options.lang,this.exhibition.mediaIndex);panel.hidden=!!this.view;}
  applyExhibitState(state){
    if(!state||!this.exhibition||!getProject(state.projectId))return;
    if(state.projectId===this.exhibition.projectId&&state.mediaIndex===this.exhibition.mediaIndex)return;
    const changedProject=state.projectId!==this.exhibition.projectId;this.exhibition={projectId:state.projectId,mediaIndex:clampMedia(state.projectId,state.mediaIndex)};this.readingMemory.save('project',state.projectId,{mediaIndex:this.exhibition.mediaIndex});this.renderExhibition();
    if(!this.view)this.writeRoute({kind:'project',id:state.projectId,mediaIndex:this.exhibition.mediaIndex,spatial:true},changedProject?'push':'replace');
  }
  activeMediaIndex(){const id=this.entity?.kind==='project'?this.entity.id:this.exhibition?.projectId;return id?this.readingMemory.read('project',id).mediaIndex:0;}
  setExhibitMedia(index){
    const id=this.entity?.kind==='project'?this.entity.id:this.exhibition?.projectId;if(!id)return;
    const next=clampMedia(id,index);this.saveReading();this.readingMemory.save('project',id,{mediaIndex:next});
    const focused=document.activeElement?.dataset.action;
    if(this.exhibition?.projectId===id){this.exhibition.mediaIndex=next;this.game?.setExhibitMedia?.(next);this.renderExhibition();}
    if(this.entity?.kind==='project')this.openProject(id,{history:'replace',focus:false});
    else this.writeRoute({kind:'project',id,mediaIndex:next,spatial:true},'replace');
    if(focused){const candidate=this.root.querySelector(`${this.view?'#page-content':'.exhibition-overlay'} [data-action="${focused}"]:not(:disabled)`);(candidate||this.root.querySelector(`${this.view?'#page-content':'.exhibition-overlay'} [data-action="media-enlarge"]`))?.focus({preventScroll:true});}
  }
  removeExhibition(){if(!this.exhibition)return;this.exhibition=null;this.exhibitionReturn=null;this.root.querySelector('.exhibition-overlay').hidden=true;this.root.querySelector('.experience').classList.remove('exhibiting');this.game?.leaveExhibit?.();}
  closeExhibition(){
    if(!this.exhibition||this.exhibitionClosing)return;
    const origin=this.exhibitionReturn||{route:null,depth:0};this.pendingReturnFocus=origin.focus||null;
    if(this.historyDepth>origin.depth){this.exhibitionClosing=true;history.go(origin.depth-this.historyDepth);return;}
    this.removeExhibition();this.showRoute(origin.route,{history:'none'});this.writeRoute(origin.route,'replace');
  }
  restoreReturnFocus(){const source=this.pendingReturnFocus;this.pendingReturnFocus=null;if(!source)return;const control=[...this.root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===source.action&&(el.dataset.id||'')===source.id&&!el.closest('[hidden],[inert]'));control?.focus({preventScroll:true});}
  close({history:mode='back',all=false}={}){
    if(this.lightboxOpen&&!all){this.closeMedia();return;}
    if(!all&&mode==='back'&&this.exhibition&&!this.view){this.closeExhibition();return;}
    this.pendingExhibition=null;this.saveReading();
    if(mode==='back'&&this.historyDepth>0){history.back();return;}
    this.closeMedia();this.view=null;this.entity=null;this.paperId=null;this.root.querySelector('.modal-backdrop').hidden=true;this.root.querySelector('.experience').classList.remove('reading');this.removeExhibition();this.setIsolation(false);this.game?.setPaused(false);
    if(mode!=='none'){this.historyDepth=0;this.writeRoute(null,'replace');}else this.route=null;
    const focus=this.exhibitionFocus||this.lastFocus;this.exhibitionFocus=null;if(focus?.isConnected&&!focus.closest('[inert],[hidden]'))focus.focus?.({preventScroll:true});else if(this.game?.started)this.canvas.focus({preventScroll:true});
  }
  setIsolation(active){this.root.querySelectorAll('.topbar,.welcome,.arrival-card,.intro-footer,.game-interface,.skip-link,#world,.exhibition-overlay').forEach(el=>{el.inert=active||(this.game?.started&&el.matches('.welcome,.arrival-card,.intro-footer'));});}
  syncOptions(){this.root.querySelector('.sound-button').innerHTML=icon(this.options.sound?'sound':'mute');document.documentElement.classList.toggle('reduce-motion',this.options.reducedMotion);this.root.querySelector('.experience').classList.toggle('gameplay-enabled',this.options.gameplay);this.root.querySelector('[data-action="gameplay"]')?.setAttribute('aria-pressed',String(this.options.gameplay));}
  trapFocus(e){const panel=this.root.querySelector(this.lightboxOpen?'.media-lightbox':'.grimoire');const nodes=[...panel.querySelectorAll('a[href],button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(!first)return;if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first.focus();}}
  toggleLanguage(){
    this.saveReading();const focusAction=document.activeElement?.dataset.action;this.options.lang=this.options.lang==='en'?'zh':'en';this.persist();this.applyLanguage();this.game?.setOption('lang',this.options.lang);
    const current=this.view,entity=this.entity;if(entity?.kind==='paper')this.openPaper(entity.id,{history:'replace',focus:false});else if(entity?.kind==='project')this.openProject(entity.id,{history:'replace',focus:false});else if(current)this.open(current,{history:'replace',focus:false});
    this.renderExhibition();if(focusAction)this.root.querySelector(`${this.view?'.grimoire':'.topbar'} [data-action="${focusAction}"]`)?.focus({preventScroll:true});
    const url=new URL(location.href);url.searchParams.set('lang',this.options.lang);history.replaceState(history.state,'',url);
  }
  async copyText(value,message){try{await navigator.clipboard.writeText(value);this.toast(message);}catch{const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';this.root.append(input);input.select();let copied=false;try{copied=document.execCommand('copy');}catch{}input.remove();this.toast(copied?message:{en:'Select and copy the address shown here.',zh:'请选中页面上显示的地址并复制。'});}}
  enlargeMedia(){
    const id=this.entity?.kind==='project'?this.entity.id:this.exhibition?.projectId,media=getProjectMedia(id,this.activeMediaIndex());if(!media)return;
    this.lightboxFocus=document.activeElement;this.lightboxOpen=true;const box=this.root.querySelector('.media-lightbox');box.hidden=false;box.innerHTML=`<header><strong>${media.title[this.options.lang]}</strong><button data-action="media-close" aria-label="${this.options.lang==='zh'?'关闭大图':'Close image'}">${icon('close')}</button></header><figure><img src="${media.src}" alt="${media.title[this.options.lang]}"/><figcaption>${media.caption[this.options.lang]} <a href="${media.source}" target="_blank" rel="noopener noreferrer">${this.options.lang==='zh'?'媒体来源':'Media source'} ↗</a></figcaption></figure>`;
    this.setIsolation(true);this.root.querySelector('.grimoire').inert=true;box.querySelector('button').focus({preventScroll:true});
  }
  closeMedia(){if(!this.lightboxOpen)return;this.lightboxOpen=false;this.root.querySelector('.media-lightbox').hidden=true;this.root.querySelector('.grimoire').inert=false;this.setIsolation(!!this.view);this.lightboxFocus?.focus?.({preventScroll:true});}
  applyLanguage(){
    const t=this.t;document.documentElement.lang=this.options.lang==='zh'?'zh-CN':'en';document.title=this.options.lang==='zh'?'Yaxin Luo — 个人网站':'Yaxin Luo — Portfolio';
    this.root.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));this.root.querySelectorAll('[data-i18n-html]').forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
    this.root.querySelector('.lang-en').classList.toggle('active',this.options.lang==='en');this.root.querySelector('.modal-language').textContent=this.options.lang==='en'?'中文':'EN';this.root.querySelector('.lang-zh').classList.toggle('active',this.options.lang==='zh');
    this.root.querySelectorAll('.chapter-nav button').forEach(b=>b.children[1].textContent=t(b.dataset.id));this.root.querySelectorAll('.location-dock button').forEach(b=>{b.querySelector('span').textContent=t(b.dataset.id);b.setAttribute('aria-label',t(b.dataset.id));});
    this.root.querySelectorAll('.spell-button').forEach((b,i)=>{b.lastElementChild.textContent=spellDefinitions[i].name[this.options.lang];b.setAttribute('aria-label',spellDefinitions[i].name[this.options.lang]);});
    this.root.querySelector('.sound-button').setAttribute('aria-label',t('sound'));this.root.querySelector('.settings-button').setAttribute('aria-label',t('settings'));this.root.querySelector('.close-button').setAttribute('aria-label',t('close'));
    this.root.querySelector('.utilities [data-action="map"]').setAttribute('aria-label',t('map'));
    this.root.querySelectorAll('.rail-tools button').forEach(b=>b.innerHTML=`${icon(({map:'map',quests:'spark',controls:'help',settings:'settings'})[b.dataset.action])}${t(b.dataset.action)}`);
    this.root.querySelector('.rail-traditional').innerHTML=`${t('traditional')}${icon('exit')}`;this.root.querySelector('.controls-hint').innerHTML=`<span><kbd>W A S D</kbd> ${t('fly')}</span><span><kbd>SHIFT</kbd> ${t('boost')}</span><span><kbd>SPACE</kbd> ${t('cast')}</span><button data-action="controls" aria-label="${t('controls')}">${icon('help')}</button>`;
    this.root.querySelector('.minimap-button>span').innerHTML=`${t('map')} <kbd>M</kbd>`;this.root.querySelector('.minimap-button').setAttribute('aria-label',t('map'));
    this.root.querySelector('.touch-boost').textContent=t('boost');this.root.querySelectorAll('[data-action=altitude]').forEach(b=>b.setAttribute('aria-label',t(Number(b.dataset.id)>0?'altitudeUp':'altitudeDown')));this.root.querySelectorAll('[data-action=camera]').forEach(b=>b.textContent=cameraViews[b.dataset.id].label[this.options.lang]);this.root.querySelector('[data-action=tour-end]').setAttribute('aria-label',t('tourEnd'));this.root.querySelector('[data-action=tour-prev]').setAttribute('aria-label',t('tourPrev'));this.root.querySelector('[data-control="up"]').setAttribute('aria-label',t('ascend'));this.root.querySelector('[data-control="down"]').setAttribute('aria-label',t('descend'));this.root.querySelector('[data-control="fire"]').setAttribute('aria-label',t('cast'));
    this.root.querySelector('.skip-link').textContent=t('portfolio');this.root.querySelectorAll('.header-nav .nav-link[data-action],.modal-tool').forEach(b=>b.setAttribute('aria-label',t(b.dataset.action==='section'?b.dataset.id:b.dataset.action)));this.root.querySelector('.shield-button').setAttribute('aria-label',t('ctrlShield'));this.root.querySelector('#thumbstick').setAttribute('aria-label',t('ctrlFlight'));this.root.querySelector('.race-hud button').setAttribute('aria-label',t('raceCancel'));this.root.querySelectorAll('a[href^="/traditional"]').forEach(a=>a.href=this.options.lang==='zh'?'/traditional/zh/':'/traditional/');this.syncOptions();
    this.root.querySelector('.flight-tools').setAttribute('aria-label',t('camera'));this.root.querySelectorAll('.world-map').forEach(el=>el.setAttribute('aria-label',t('map')));this.root.querySelector('.chapter-nav').setAttribute('aria-label',t('journal'));this.root.querySelectorAll('.header-nav,.location-dock').forEach(el=>el.setAttribute('aria-label',t('portfolio')));
    this.root.querySelectorAll('.persistent-cv,.modal-cv').forEach(link=>{link.setAttribute('aria-label',`${t('cv')} · PDF`);link.setAttribute('href',cvForLanguage(this.options.lang));});
    this.root.querySelectorAll('a[data-i18n="cv"]').forEach(link=>link.setAttribute('href',cvForLanguage(this.options.lang)));
    this.canvas.setAttribute('aria-label',this.options.lang==='zh'?'扫把飞行魔法世界':'Magical broom flight world');this.updateStatus();
  }
  update(s){
    this.snapshot=s;if(!this.ready)this.loaded();this.syncStarted(s.started);
    this.root.querySelector('#discovery-count').textContent=`${s.progress.visited.length} / 6`;this.root.querySelector('#crystal-count').textContent=`${s.progress.crystals.length} / 8`;
    for(const [key,value] of [['health',s.health],['mana',s.mana]]){this.root.querySelector(`#${key}-fill`).style.width=`${Math.max(0,value)}%`;this.root.querySelector(`#${key}-value`).textContent=Math.round(value);}
    this.root.querySelectorAll('.spell-button').forEach((b,i)=>{b.classList.toggle('selected',i===s.spell);b.setAttribute('aria-pressed',String(i===s.spell));b.classList.toggle('depleted',s.mana<spellDefinitions[i].cost);});
    this.root.querySelector('.shield-button').classList.toggle('active',s.shield>0);
    const nearby=locations.find(l=>l.id===s.nearest),paper=publications.find(p=>p.id===s.nearestPaper),exhibit=getProject(s.nearestExhibition);
    this.root.querySelector('.interaction-prompt').hidden=!!this.exhibition||(!nearby&&!paper&&!exhibit&&!s.nearestClock&&!s.nearestArtifact);
    if(exhibit)this.root.querySelector('#nearby-name').textContent=exhibit.shortTitle[this.options.lang];
    else if(s.nearestClock)this.root.querySelector('#nearby-name').textContent=this.options.lang==='zh'?'天文钟 · 选择时段':'Astronomical clock · Choose the light';
    else if(s.nearestArtifact)this.root.querySelector('#nearby-name').textContent=s.nearestArtifact.label[this.options.lang];
    else if(paper)this.root.querySelector('#nearby-name').textContent=paper.title[this.options.lang].split(/[:：]/)[0];
    else if(nearby)this.root.querySelector('#nearby-name').textContent=this.t(nearby.id);
    this.root.querySelector('.interaction-prompt strong').textContent=!exhibit&&s.nearestClock?(this.options.lang==='zh'?'切换时段':'Change the light'):this.t('interact');

    this.root.querySelectorAll('.player-dot,.player-halo').forEach(p=>{const at=mapPoint(s.position.x,s.position.z);p.setAttribute('cx',at.x);p.setAttribute('cy',at.y);});
    this.root.querySelector('#altitude-value').innerHTML=`${Math.round(s.position.y)} <small>m</small>`;
    this.root.querySelector('#altitude-fill').style.width=`${Math.max(0,s.position.y)/worldBounds.ceiling*100}%`;
    this.root.querySelectorAll('[data-action=camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===s.cameraView)));
    const tour=s.tour?tourStops[s.tour.index]:null;
    this.root.querySelector('.tour-card').hidden=!tour;this.root.querySelector('.experience').classList.toggle('touring',!!tour);
    if(tour){this.root.querySelector('#tour-title').textContent=tour.title[this.options.lang];this.root.querySelector('#tour-description').textContent=tour.description[this.options.lang];this.root.querySelector('#tour-count').textContent=`0${s.tour.index+1} / 06`;this.root.querySelector('[data-action=tour-prev]').disabled=s.tour.index===0;this.root.querySelector('[data-action=tour-next]>span').textContent=this.t(s.tour.index===tourStops.length-1?'tourEnd':'tourNext');}
    const race=s.race?.active;this.root.querySelector('.experience').classList.toggle('racing',!!race);this.root.querySelector('.race-hud').hidden=!race;if(race){this.root.querySelector('#race-progress').textContent=`${s.race.index} / ${ringPositions.length}`;this.root.querySelector('#race-time').textContent=Math.max(0,s.race.timeLeft).toFixed(1);}
    if(this.view==='settings'){const audioStatus=this.root.querySelector('#audio-status'),audioRetry=this.root.querySelector('[data-action="audio-retry"]');if(audioStatus){const text=this.audioStatusText(s.audio);if(audioStatus.textContent!==text)audioStatus.textContent=text;}if(audioRetry)audioRetry.hidden=!(s.audio?.enabled&&s.audio.status==='unavailable');const p=this.root.querySelector('#perf-value');if(p)p.textContent=`${Math.round(s.fps)} ${this.t('fps')} · ${this.t(s.quality||this.options.quality)}${s.renderSize?` · ${s.renderSize.width} × ${s.renderSize.height} · ${s.renderSize.samples?`${s.renderSize.samples}× MSAA`:'SMAA'}`:''}`;}
    if(s.landmarks){const container=this.root.querySelector('#landmark-labels');container.innerHTML=s.landmarks.filter(l=>l.visible).map(p=>{const l=locations.find(l=>l.id===p.id);return `<span class="world-label" style="left:${p.x*100}%;top:${p.y*100}%"><i>${l.number}</i><span>${l.name[this.options.lang]}</span></span>`;}).join('');}
    this.root.querySelector('.experience').dataset.exhibition=this.exhibition?.projectId||'';
    this.root.querySelector('.experience').dataset.position=JSON.stringify(s.position);this.root.querySelector('.experience').dataset.metrics=JSON.stringify({fps:s.fps,drawCalls:s.drawCalls,triangles:s.triangles});
    this.root.querySelector('.experience').dataset.cameraView=s.cameraView||'follow';
    this.root.querySelector('.experience').dataset.tour=s.tour?String(s.tour.index):'';
    this.root.querySelector('.experience').dataset.gameState=s.started?(s.paused?'paused':'playing'):'intro';
  }
  toast(message,duration=3800){const el=this.root.querySelector('.toast');el.innerHTML=`${icon('spark')}<span></span>`;el.querySelector('span').textContent=typeof message==='string'?message:message[this.options.lang];el.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('visible'),duration);}
  mapSVG(small=false){
    const islandPaths=islands.map(i=>{const points=Array.from({length:96},(_,n)=>{const a=n/96*Math.PI*2,r=.94+.10*Math.sin(a*3+.7)+.055*Math.cos(a*7);const p=mapPoint(i.x+Math.cos(a)*i.rx*r,i.z+Math.sin(a)*i.rz*r);return `${n?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;});return `<path class="map-land" d="${points.join('')}Z"/>`;}).join('');
    const center=mapPoint(court.x,court.z),player=mapPoint(this.snapshot.position.x,this.snapshot.position.z);
    return `<svg class="world-map ${small?'small':''}" viewBox="0 0 180 180" role="img" aria-label="${this.t('map')}"><defs><pattern id="${small?'mini':'full'}grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0v12" fill="none" stroke="currentColor" stroke-width=".2" opacity=".15"/></pattern></defs><rect width="180" height="180" fill="url(#${small?'mini':'full'}grid)"/>${islandPaths}${locations.map(l=>{const p=mapPoint(l.x,l.z);return `<path class="map-paths" d="M${center.x} ${center.y}Q${(center.x+p.x)/2+4} ${center.y} ${p.x} ${p.y}"/><g transform="translate(${p.x} ${p.y})"><circle r="${small?'3':'6'}"/><text y="${small?'-6':'1.9'}" text-anchor="middle">${l.number}</text></g>`;}).join('')}<circle class="player-halo" cx="${player.x}" cy="${player.y}" r="5"/><circle class="player-dot" cx="${player.x}" cy="${player.y}" r="2.6"/><text class="map-north" x="165" y="16">N</text><path d="m167 20-2 7 2-2 2 2Z" fill="currentColor"/></svg>`;
  }
  mapContent(){const t=this.t;return `<div class="extra-page map-page"><span class="page-eyebrow">${t('allOpen')}</span><h2>${t('mapTitle')}</h2><p class="page-lede">${t('mapIntro')}</p><button class="paper-button filled map-tour" data-action="tour" data-id="0">${icon('compass')}${t('tour')}${icon('arrow')}</button><div class="map-layout"><div class="large-map">${this.mapSVG()}<span class="map-legend"><i></i>${t('mapYou')}</span><span class="map-caption">${this.options.lang==='zh'?'学院全景地图<br>个人资料与作品':'THE ACADEMY GROUNDS<br>PLACES & PORTFOLIO'}</span></div><div class="destination-list">${locations.map(l=>`<div class="destination-row"><span class="destination-symbol">${icon(l.icon)}</span><div><h3>${l.name[this.options.lang]}</h3><p>${l.subtitle[this.options.lang]}</p><div><button data-action="section" data-id="${l.id}">${t('read')}${icon('arrow')}</button><button data-action="travel" data-id="${l.id}">${icon('portal')}${t('teleport')}</button></div></div></div>`).join('')}</div></div></div>`;}
  settingsContent(){const t=this.t;return `<div class="extra-page settings-page"><span class="page-eyebrow">${t('settings')}</span><h2>${t('preferences')}</h2><div class="setting-row"><div><h3>${t('quality')}</h3><p>${t('qualityHelp')}</p></div><select data-option="quality" aria-label="${t('quality')}">${['high','balanced','low'].map(q=>`<option value="${q}" ${this.options.quality===q?'selected':''}>${t(q)}</option>`).join('')}</select></div><div class="setting-row"><div><h3>${t('motion')}</h3><p>${t('motionHelp')}</p></div><label class="toggle"><input type="checkbox" data-option="reducedMotion" ${this.options.reducedMotion?'checked':''} aria-label="${t('motion')}"/><span></span></label></div><div class="setting-row"><div><h3>${t('sound')}</h3><p>${t('audioHelp')}</p><output class="audio-status" id="audio-status" role="status">${this.audioStatusText()}</output><button class="audio-retry" data-action="audio-retry" ${this.snapshot.audio?.enabled&&this.snapshot.audio.status==='unavailable'?'':'hidden'}>${t('retry')}</button></div><label class="toggle"><input type="checkbox" data-option="sound" ${this.options.sound?'checked':''} aria-label="${t('sound')}"/><span></span></label></div><div class="setting-row"><div><h3>${t('timeOfDay')}</h3><p>${this.options.lang==='zh'?'选择一种光线，或让时段缓慢变化。':'Choose a light, or let the day change slowly.'}</p></div><select data-option="timeOfDay" aria-label="${t('timeOfDay')}">${['auto','dawn','day','dusk','night'].map(value=>`<option value="${value}" ${this.options.timeOfDay===value?'selected':''}>${t(value)}</option>`).join('')}</select></div>${['musicVolume','effectsVolume'].map(key=>`<div class="setting-row"><div><h3>${t(key)}</h3></div><label class="volume-control"><input type="range" min="0" max="1" step="0.05" value="${this.options[key]}" data-option="${key}" aria-label="${t(key)}"/><output>${Math.round(this.options[key]*100)}%</output></label></div>`).join('')}<div class="setting-row"><div><h3>${t('gameplay')}</h3><p>${this.options.lang==='zh'?'显示任务、护盾、魔力与咒语。作品与联系方式始终可读。':'Show quests, ward, magic and spells. Portfolio content stays available.'}</p></div><label class="toggle"><input type="checkbox" data-option="gameplay" ${this.options.gameplay?'checked':''} aria-label="${t('gameplay')}"/><span></span></label></div><div class="setting-row"><div><h3>${t('lang')}</h3></div><button class="paper-button" data-action="language">English / 中文 ${icon('arrow')}</button></div><p class="music-credit">${this.options.lang==='zh'?'配乐：The Cynic Project · CC0。':'Music by The Cynic Project · CC0. '}<a href="/audio/academy/sources.json" target="_blank" rel="noopener noreferrer">${this.options.lang==='zh'?'曲目与来源':'Tracks and sources'} ↗</a></p><div class="performance"><span>${t('performance')}</span><output id="perf-value">—</output></div><div class="reset-section"><h3>${t('reset')}</h3><p>${t('resetHelp')}</p>${this.resetConfirm?`<button class="paper-button danger" data-action="confirm-reset">${t('resetConfirm')}</button> <button class="paper-button" data-action="cancel-reset">${t('cancel')}</button>`:`<button class="paper-button" data-action="reset">${t('reset')}</button>`}</div><p class="local-note">${icon('shield')}${t('local')}</p></div>`;}
  questsContent(){const t=this.t,p=this.snapshot.progress,a=achievements(p),numbers=[`${p.visited.length} / 6`,`${p.crystals.length} / 8`,`${Math.min(p.banished,5)} / 5`,p.bestTime?`${p.bestTime.toFixed(1)} s`:'—'],icons=['compass','diamond','shield','trophy'];return `<div class="extra-page"><span class="page-eyebrow">${t('quests')}</span><h2>${t('questsTitle')}</h2><p class="page-lede">${t('questsIntro')}</p><div class="quest-list">${a.map((done,i)=>`<article class="quest-card ${done?'complete':''}"><div class="quest-seal">${icon(icons[i])}</div><div><h3>${t('quest'+(i+1))}</h3><p>${t('quest'+(i+1)+'desc')}</p><span>${done?`${icon('check')}${t('complete')}`:numbers[i]}</span></div><b>${numbers[i]}</b></article>`).join('')}</div><div class="race-action"><button class="paper-button filled" data-action="${this.snapshot.race?.active?'end-race':'start-race'}">${icon('trophy')}${t(this.snapshot.race?.active?'raceCancel':'raceStart')}${icon('arrow')}</button>${p.bestTime?`<span>${t('best')}: ${p.bestTime.toFixed(1)} s</span>`:''}</div><h3 class="spells-heading">${t('spellGuide')}</h3><p class="page-lede">${t('spellGuideDesc')}</p><div class="spell-guide">${spellDefinitions.map((s,i)=>`<div><kbd>${i+1}</kbd><h4>${s.name[this.options.lang]}</h4><p>${s.subtitle[this.options.lang]}</p><small>${s.cost} ${t('mana')} · ${s.cooldown}s</small></div>`).join('')}</div><p class="local-note">${icon('shield')}${t('local')}</p></div>`;}
  controlsContent(){const t=this.t;const rows=[['W A S D / ↑ ← ↓ →','ctrlFlight'],['SHIFT','boost'],['R / F','ctrlAltitude'],['V','ctrlCamera'],['SPACE','ctrlSpell'],['1 / 2 / 3','ctrlChoose'],['Q','ctrlShield'],['E','ctrlInteract'],['ESC','ctrlMenu'],['M','ctrlMap']];return `<div class="extra-page"><span class="page-eyebrow">${t('controls')}</span><h2>${t('controlTitle')}</h2><p class="page-lede">${t('controlIntro')}</p><div class="control-grid">${rows.map(([k,v])=>`<div><span>${t(v)}</span><kbd>${k}</kbd></div>`).join('')}</div><p class="control-note">${icon('compass')}${t('rotate')}</p><p class="mobile-note">${t('mobileHelp')}</p><button class="paper-button filled" data-action="close">${t('resume')}${icon('arrow')}</button></div>`;}
}
