import {yangquelongRefinedGardenStudioEntry} from './yangquelong-refined-garden-studio-entry.js';
import {yangquelongGardenStudioEntry} from './yangquelong-garden-studio-entry.js';
import {hanjingtangStudyViews} from './hanjingtang-study-views.js';
import {zhengjuesiViews} from './zhengjuesi-study-views.js';
import {haiyueViews} from './haiyue-study-views.js';
import {jiuzhouStudyViews,jiuzhouSectionStudyViews} from './jiuzhou-study-views.js';
import {fuhaiStudyViews} from './fuhai-study-views.js';
import {gardenVegetationViews} from './garden-vegetation-views.js';
import {spreadingPineReviewViews} from './spreading-pine-views.js';
import {huanghuazhenStudyViews} from './huanghuazhen-views.js';
import {yangquelongStudyViews} from './yangquelong-views.js';
import {xianfashanStudyViews,fangheXianfahuaStudyViews,xianfaqiaoStudyViews} from './xianfa-landscape-views.js';
import {copperSheepStudyViews} from './xieqiqu-copper-sheep.js';
import {gardenUnderstoryStudyViews} from './garden-understory-study-views.js';
import {stoneFishStudyViews,stoneFishStudyId} from './xieqiqu-stone-fish-views.js';
import {copperSwallowShortNeckStudyViews,copperSwallowShortNeckStudyId} from './xieqiqu-swallow-shortneck-views.js';
import {copperSwallowUnderwingStudyViews,copperSwallowUnderwingStudyId} from './xieqiqu-swallow-underwing-views.js';
import {stoneFishPoolStudyViews,stoneFishPoolStudyId} from './xieqiqu-stone-fish-pool-views.js';
import {stoneFishPoolR2StudyViews,stoneFishPoolR2StudyId} from './xieqiqu-stone-fish-pool-r2-views.js';
import {stoneFishPoolR3StudyViews,stoneFishPoolR3StudyId} from './xieqiqu-stone-fish-pool-r3-views.js';
import {stoneFishPoolR4StudyViews,stoneFishPoolR4StudyId} from './xieqiqu-stone-fish-pool-r4-views.js';

// View directions are world-space vectors from the subject towards the camera.
// A sculpture's orientationGroup instead rotates that vector from its local space.
const haiyantangWhole=['west-hall','waterworks','west-stairs','zodiac-fountain'];
const zodiacLabels={rat:'鼠 · Rat',ox:'牛 · Ox',tiger:'虎 · Tiger',rabbit:'兔 · Rabbit',dragon:'龙 · Dragon',snake:'蛇 · Snake',horse:'马 · Horse',goat:'羊 · Goat',monkey:'猴 · Monkey',rooster:'鸡 · Rooster',dog:'狗 · Dog',pig:'猪 · Pig'};
const zodiacViews=Object.fromEntries(Object.entries(zodiacLabels).map(([id,label])=>[id,{label,groups:[`zodiac-${id}`],isolate:[`zodiac-${id}`],orientationGroup:`zodiac-${id}`,direction:[.16,.22,1]}]));
const houndViews=Object.fromEntries(Array.from({length:10},(_,index)=>{
  const number=String(index+1).padStart(2,'0'),group=`dashuifa-hound-${number}`;
  // The water arc belongs to the fountain composition, not the dog's closeup bounds.
  return [`hound-${number}`,{label:`猎犬 ${number} · Hound ${number}`,groups:[`${group}-body`,`${group}-open-mouth-spout`],isolate:[`${group}-body`,`${group}-open-mouth-spout`],orientationGroup:group,direction:[.16,.22,1]}];
}));

export const studioAssets={
  'yangquelong-refined-garden-r3':yangquelongRefinedGardenStudioEntry,
  'yangquelong-garden-r1':yangquelongGardenStudioEntry,
  'xieqiqu-stone-fish-pool-r4':{
    id:'xieqiqu-stone-fish-pool-r4',label:'谐奇趣南池 · 层叠卷浪石座',menuLabel:'水景 · 层叠卷浪石座',english:'Layered carved wave supports',studyId:stoneFishPoolR4StudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:-.68,defaultView:'whole',sculptureDefaultView:'whole',sculpturePlaceholder:'请使用水景视角',
    views:stoneFishPoolR4StudyViews,sculptures:{},
    async loadFactory({signal}={}){
      const {prepareXieqiquStoneFishMaterialPixels,createXieqiquStoneFishPoolR4Study}=await import('./xieqiqu-stone-fish-pool-r2-study.js');
      const pixels=await prepareXieqiquStoneFishMaterialPixels({signal}),release=()=>pixels.dispose();
      if(signal?.aborted){release();signal.throwIfAborted();}
      signal?.addEventListener('abort',release,{once:true});
      return ()=>{try{signal?.throwIfAborted();return createXieqiquStoneFishPoolR4Study({pixels,signal});}finally{signal?.removeEventListener('abort',release);release();}};
    },
  },
  'xieqiqu-stone-fish-pool-r3':{
    id:'xieqiqu-stone-fish-pool-r3',label:'谐奇趣南池 · 回卷石座精修',menuLabel:'水景 · 回卷石座精修',english:'Refined curled stone wave supports',studyId:stoneFishPoolR3StudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:-.68,defaultView:'whole',sculptureDefaultView:'whole',sculpturePlaceholder:'请使用水景视角',
    views:stoneFishPoolR3StudyViews,sculptures:{},
    async loadFactory({signal}={}){
      const {prepareXieqiquStoneFishMaterialPixels,createXieqiquStoneFishPoolR3Study}=await import('./xieqiqu-stone-fish-pool-r2-study.js');
      const pixels=await prepareXieqiquStoneFishMaterialPixels({signal}),release=()=>pixels.dispose();
      if(signal?.aborted){release();signal.throwIfAborted();}
      signal?.addEventListener('abort',release,{once:true});
      return ()=>{try{signal?.throwIfAborted();return createXieqiquStoneFishPoolR3Study({pixels,signal});}finally{signal?.removeEventListener('abort',release);release();}};
    },
  },
  'xieqiqu-stone-fish-pool-r2':{
    id:'xieqiqu-stone-fish-pool-r2',label:'谐奇趣南池 · 卷浪石座与流水',menuLabel:'水景 · 卷浪石座与流水',english:'Carved wave supports and moving water',studyId:stoneFishPoolR2StudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:-.68,defaultView:'whole',sculptureDefaultView:'whole',sculpturePlaceholder:'请使用水景视角',
    views:stoneFishPoolR2StudyViews,sculptures:{},
    async loadFactory({signal}={}){
      const {prepareXieqiquStoneFishMaterialPixels,createXieqiquStoneFishPoolR2Study}=await import('./xieqiqu-stone-fish-pool-r2-study.js');
      const pixels=await prepareXieqiquStoneFishMaterialPixels({signal}),release=()=>pixels.dispose();
      if(signal?.aborted){release();signal.throwIfAborted();}
      signal?.addEventListener('abort',release,{once:true});
      return ()=>{try{signal?.throwIfAborted();return createXieqiquStoneFishPoolR2Study({pixels,signal});}finally{signal?.removeEventListener('abort',release);release();}};
    },
  },
  'xieqiqu-stone-fish-pool':{
    id:'xieqiqu-stone-fish-pool',label:'谐奇趣南池 · 石鱼与水景',menuLabel:'水景 · 南池与四鱼',english:'Stone fish and south pool',studyId:stoneFishPoolStudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:-.68,defaultView:'whole',sculptureDefaultView:'whole',sculpturePlaceholder:'请使用水景视角',
    views:stoneFishPoolStudyViews,sculptures:{},
    async loadFactory({signal}={}){
      const {prepareXieqiquStoneFishMaterialPixels,createXieqiquStoneFishPoolStudy}=await import('./xieqiqu-stone-fish-pool-study.js');
      const pixels=await prepareXieqiquStoneFishMaterialPixels({signal}),release=()=>pixels.dispose();
      if(signal?.aborted){release();signal.throwIfAborted();}
      signal?.addEventListener('abort',release,{once:true});
      return ()=>{try{signal?.throwIfAborted();return createXieqiquStoneFishPoolStudy({pixels,signal});}finally{signal?.removeEventListener('abort',release);release();}};
    },
  },
  'xieqiqu-copper-swallow-underwing':{
    id:'xieqiqu-copper-swallow-underwing',label:'谐奇趣铜鸟 · 羽层精修',menuLabel:'雕塑 · 铜鸟羽层精修',english:'Copper bird feather study',studyId:copperSwallowUnderwingStudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:0,defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:copperSwallowUnderwingStudyViews,sculptures:{},
    async loadFactory(){const {createXieqiquCopperSwallowUnderwingReviewStudy}=await import('./xieqiqu-swallow-shortneck-study.js');return createXieqiquCopperSwallowUnderwingReviewStudy;},
  },
  'xieqiqu-stone-fish':{
    id:'xieqiqu-stone-fish',label:'谐奇趣翻尾石鱼',menuLabel:'雕塑 · 翻尾石鱼',english:'Upturned stone fish',studyId:stoneFishStudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:0,defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:stoneFishStudyViews,sculptures:{},
    async loadFactory({signal,materialVariant}={}){
      if(!materialVariant){const {createXieqiquStoneFishReviewStudy}=await import('./xieqiqu-sculpture-studies.js');return createXieqiquStoneFishReviewStudy;}
      if(materialVariant!=='marble-r1')throw new Error(`Unknown stone fish material study: ${materialVariant}`);
      const {prepareXieqiquStoneFishMaterialPixels,createXieqiquStoneFishMaterialStudy}=await import('./xieqiqu-stone-fish-material-study.js');
      const pixels=await prepareXieqiquStoneFishMaterialPixels({signal});
      const release=()=>pixels.dispose();
      if(signal?.aborted){release();signal.throwIfAborted();}
      signal?.addEventListener('abort',release,{once:true});
      return ()=>{try{signal?.throwIfAborted();return createXieqiquStoneFishMaterialStudy({pixels,signal});}finally{signal?.removeEventListener('abort',release);release();}};
    },
  },
  'xieqiqu-copper-swallow-shortneck':{
    id:'xieqiqu-copper-swallow-shortneck',label:'谐奇趣铜鸟',menuLabel:'雕塑 · 短颈展翼铜鸟',english:'Copper bird study',studyId:copperSwallowShortNeckStudyId,
    coordinates:{up:'+Y',front:'+Z'},groundY:0,defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:copperSwallowShortNeckStudyViews,sculptures:{},
    async loadFactory(){const {createXieqiquCopperSwallowShortNeckReviewStudy}=await import('./xieqiqu-swallow-shortneck-study.js');return createXieqiquCopperSwallowShortNeckReviewStudy;},
  },
  'garden-understory':{
    id:'garden-understory',label:'湖岸伴生植物',menuLabel:'植物 · 细叶草、羽蕨与低花灌木',english:'Lakeside understory',studyId:'garden-understory-study-r2',
    coordinates:{up:'+Y',front:'+Z'},groundY:0,defaultView:'understory-whole',sculptureDefaultView:'understory-whole',sculpturePlaceholder:'请使用分件视角',
    views:Object.fromEntries(gardenUnderstoryStudyViews.map(view=>[view.id,{...view,margin:view.padding,...(!['understory-whole','understory-roots','understory-flower'].includes(view.id)?{isolate:view.groups}:{})}])),sculptures:{},
    async loadFactory(){const {createGardenUnderstoryStudy}=await import('./garden-understory-study.js');return createGardenUnderstoryStudy;},
  },
  'xieqiqu-copper-sheep':{
    id:'xieqiqu-copper-sheep',label:'谐奇趣铜羊',menuLabel:'雕塑 · 铜羊单件',english:'Copper ram study',studyId:'xieqiqu-copper-sheep-r4-study',
    coordinates:{up:'+Y',front:'+Z'},groundY:0,defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:copperSheepStudyViews,sculptures:{},
    async loadFactory(){const {createXieqiquCopperSheepStudy}=await import('./xieqiqu-study.js');return createXieqiquCopperSheepStudy;},
  },
  jiuzhou:{
    id:'jiuzhou',label:'九洲清晏',menuLabel:'九洲清晏 · 三路院落与岛岸',english:'Jiuzhou Qingyan',studyId:'jiuzhou-qingyan-late-ensemble-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:-2.67,defaultView:'threequarter',sculptureDefaultView:'ruyi-carving',sculpturePlaceholder:'请使用分件视角',
    views:jiuzhouStudyViews,sculptures:{},
    async loadFactory(){const {createJiuzhouStudy}=await import('./jiuzhou-study.js');return createJiuzhouStudy;},
  },
  ...Object.fromEntries([
    ['central','中路三殿与戏院','Central halls and theatre','createJiuzhouCentralStudy'],
    ['western','西路寝殿与园居','Western residential courts','createJiuzhouWesternStudy'],
    ['eastern','东路天地一家春','Eastern residential courts','createJiuzhouEasternStudy'],
    ['waterfront','岛岸与如意桥','Shore and Ruyi Bridge','createJiuzhouWaterfrontStudy'],
  ].map(([section,label,english,factory])=>{
    const id=`jiuzhou-${section}`;
    return [id,{id,label:`九洲 · ${label}`,menuLabel:`九洲分区 · ${label}`,english,studyId:`jiuzhou-${section}-study`,
      coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:section==='waterfront'?-2.67:.025,defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
      views:jiuzhouSectionStudyViews[section],sculptures:{},
      async loadFactory(){const module=await import('./jiuzhou-study.js');return module[factory];},
    }];
  })),
  haiyue:{
    id:'haiyue',label:'海岳开襟',menuLabel:'海岳开襟 · 双圆台与湖心楼阁',english:'Haiyue Kaijin',studyId:'haiyue-kaijin-late-ensemble-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:-2.3,defaultView:'threequarter',sculptureDefaultView:'marble',sculpturePlaceholder:'请使用分件视角',
    views:Object.fromEntries(Object.entries(haiyueViews).map(([key,value])=>[key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),value])),sculptures:{},
    async loadFactory(){const {createHaiyueStudy}=await import('./haiyue-study.js');return createHaiyueStudy;},
  },
  zhengjuesi:{
    id:'zhengjuesi',label:'正觉寺',menuLabel:'正觉寺 · 殿亭与四进院落',english:'Zhengjuesi',studyId:'zhengjuesi-historical-architecture-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:0,defaultView:'threequarter',sculptureDefaultView:'gate-arch',sculpturePlaceholder:'请使用分件视角',
    views:{...Object.fromEntries(Object.entries(zhengjuesiViews).map(([key,value])=>[key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),value])),
      'stairwell':{label:'最上楼 · 实际梯洞与转折木梯',groups:['zhengjuesi-zuishanglou-upper-floor-and-stair'],isolate:['zhengjuesi-zuishanglou-upper-floor-and-stair'],crop:{min:[.74,0,0],max:[1,1,1]},direction:[.8,.68,1],margin:1.12},
    },sculptures:{},
    async loadFactory(){const {createZhengjuesiStudy}=await import('./zhengjuesi-study.js');return createZhengjuesiStudy;},
  },
  hanjingtang:{
    id:'hanjingtang',label:'含经堂与淳化轩',menuLabel:'含经堂 · 院落与碑廊',english:'Hanjingtang and Chunhuaxuan',studyId:'hanjingtang-chunhuaxuan-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'carving',sculpturePlaceholder:'请使用分件视角',
    views:hanjingtangStudyViews,sculptures:{},
    async loadFactory({signal}={}){const {createHanjingtangStudy,prepareHanjingtangAssets}=await import('./hanjingtang-study.js');await prepareHanjingtangAssets({signal});return createHanjingtangStudy;},
  },
  xianfashan:{
    id:'xianfashan',label:'线法山',menuLabel:'线法山 · 螺旋山径',english:'Xianfashan',studyId:'xianfashan-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:xianfashanStudyViews,sculptures:{},
    async loadFactory({signal}={}){const [{createXianfashanStudy},{prepareXianfashanTexturePixels}]=await Promise.all([import('./xianfa-landscape-study.js'),import('./xianfashan-materials.js')]);const texturePixels=await prepareXianfashanTexturePixels({signal});return ()=>createXianfashanStudy({texturePixels});},
  },
  'fanghe-xianfahua':{
    id:'fanghe-xianfahua',label:'方河与线法画',menuLabel:'方河 · 线法画',english:'Fanghe and Xianfahua',studyId:'fanghe-xianfahua-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:fangheXianfahuaStudyViews,sculptures:{},
    async loadFactory(){const {createFangheXianfahuaStudy}=await import('./xianfa-landscape-study.js');return createFangheXianfahuaStudy;},
  },
  xianfaqiao:{
    id:'xianfaqiao',label:'线法桥',menuLabel:'线法桥 · 谐奇趣西',english:'Xianfaqiao',studyId:'xianfaqiao-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'threequarter',sculpturePlaceholder:'请使用分件视角',
    views:xianfaqiaoStudyViews,sculptures:{},
    async loadFactory(){const {createXianfaqiaoStudy}=await import('./xianfa-landscape-study.js');return createXianfaqiaoStudy;},
  },
  huanghuazhen:{
    id:'huanghuazhen',label:'黄花阵',menuLabel:'黄花阵 · 迷阵与花园门',english:'Huanghuazhen',studyId:'huanghuazhen-maze-and-gate-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'pavilion',sculpturePlaceholder:'请使用分件视角',
    views:huanghuazhenStudyViews,sculptures:{},
    async loadFactory(){const {createHuanghuazhenStudy}=await import('./huanghuazhen-study.js');return createHuanghuazhenStudy;},
  },
  yangquelong:{
    id:'yangquelong',label:'养雀笼',menuLabel:'养雀笼 · 两面门庭',english:'Yangquelong',studyId:'yangquelong-aviary-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'fountain',sculpturePlaceholder:'请使用分件视角',
    views:yangquelongStudyViews,sculptures:{},
    async loadFactory(){const {createYangquelongStudy}=await import('./yangquelong-study.js');return createYangquelongStudy;},
  },
  'spreading-garden-pine-r4':{
    id:'spreading-garden-pine-r4',label:'横展庭园松 · 当代单株',menuLabel:'植物 · 横展庭园松（当代造型）',english:'Contemporary spreading garden pine',studyId:'spreading-garden-pine-r4',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:0,defaultView:'whole',sculptureDefaultView:'whole',sculpturePlaceholder:'请使用单株视角',
    views:spreadingPineReviewViews,sculptures:{},
    async loadFactory({signal}={}){const {prepareSpreadingPineFactory}=await import('./spreading-pine-loader.js');return prepareSpreadingPineFactory({signal});},
  },
  'yangquelong-surface-r1':{
    id:'yangquelong-surface-r1',label:'养雀笼 · 当代庭院花床',menuLabel:'养雀笼 · 当代庭院花床',english:'Yangquelong contemporary garden courts',studyId:'yangquelong-surface-r1',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'fountain',sculpturePlaceholder:'请使用分件视角',
    views:yangquelongStudyViews,sculptures:{},
    async loadFactory(options={}){const {prepareYangquelongSurfaceFactory}=await import('./yangquelong-surface.js');return prepareYangquelongSurfaceFactory(options);},
  },
  vegetation:{
    id:'vegetation',label:'园林植物与湖石',menuLabel:'植物 · 柳松柏荷与湖石',english:'Plants and garden rocks',studyId:'garden-vegetation-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:0,defaultView:'overview',sculptureDefaultView:'overview',sculpturePlaceholder:'请使用分件视角',
    views:gardenVegetationViews,sculptures:{},
    async loadFactory({signal,specimen}={}){
      const [{createGardenVegetationStudy},{prepareVegetationTexturePixels,prepareLakeStoneTexturePixels}]=await Promise.all([import('./garden-vegetation.js'),import('./vegetation-textures.js')]);
      if(specimen&&specimen!=='lake-rock')throw new Error(`Unsupported standalone specimen: ${specimen}`);
      const texturePixels=specimen?{stone:await prepareLakeStoneTexturePixels({signal})}:await prepareVegetationTexturePixels({signal});
      return options=>createGardenVegetationStudy({...options,...(specimen?{specimens:[specimen],arrange:false}:{}),texturePixels});
    },
  },
  fanghu:{
    id:'fanghu',label:'方壶胜境',menuLabel:'方壶胜境 · 三亭九楼',english:'Fanghu Shengjing',studyId:'fanghu-shengjing-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'front',sculpturePlaceholder:'此模型暂无单独雕像',
    views:fuhaiStudyViews.fanghu,sculptures:{},
    async loadFactory(){const {createFanghuStudy}=await import('./fuhai-palaces.js');return createFanghuStudy;},
  },
  pengdao:{
    id:'pengdao',label:'蓬岛瑶台',menuLabel:'蓬岛瑶台 · 湖上三岛',english:'Pengdao Yaotai',studyId:'pengdao-yaotai-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'front',sculpturePlaceholder:'此模型暂无单独雕像',
    views:fuhaiStudyViews.pengdao,sculptures:{},
    async loadFactory(){const {createPengdaoStudy}=await import('./fuhai-palaces.js');return createPengdaoStudy;},
  },
  haiyantang:{
    id:'haiyantang',label:'海晏堂',menuLabel:'海晏堂 · 生肖水法',english:'Haiyantang',studyId:'haiyantang-proportional-study',
    coordinates:{up:'+Y',north:'-X',east:'-Z'},defaultView:'threequarter',sculptureDefaultView:'fountain',sculpturePlaceholder:'选择生肖或中央石蚌',
    views:{
      front:{label:'西正面 · West elevation',groups:['west-hall','west-stairs','zodiac-fountain'],direction:[0,.20,1]},
      threequarter:{label:'斜向全貌 · Three-quarter',groups:haiyantangWhole,direction:[.82,.56,1]},
      north:{label:'北侧 · North',groups:haiyantangWhole,direction:[-1,.18,0]},
      south:{label:'南侧 · South',groups:haiyantangWhole,direction:[1,.18,0]},
      back:{label:'东侧水工楼 · East waterworks',groups:['waterworks'],direction:[.15,.22,-1]},
      aerial:{label:'俯瞰 · Aerial',groups:haiyantangWhole,direction:[.22,1,.24]},
      fountain:{label:'生肖水法 · Zodiac fountain',groups:['zodiac-fountain'],direction:[.05,.3,1],margin:1.05},
      stone:{label:'石雕与窗 · Stone and windows',groups:['west-hall'],isolate:['west-hall'],direction:[.12,.05,1],margin:1.1,crop:{min:[.12,.22,.86],max:[.40,.68,1]}},
      roof:{label:'屋顶瓦作 · Glazed roof',groups:['west-hall'],direction:[.35,.52,1],margin:1.08,crop:{min:[0,.68,0],max:[1,1,1]}},
      stairs:{label:'阶梯与栏杆 · Stairs and balustrades',groups:['west-stairs'],direction:[-.4,.2,1],margin:1.02},
    },
    sculptures:{...zodiacViews,clam:{label:'中央石蚌 · Clam',groups:['giant-clam'],isolate:['giant-clam'],orientationGroup:'giant-clam',direction:[.06,.22,1]}},
    async loadFactory(){const {createHaiyantangStudy}=await import('./haiyantang-study.js');return createHaiyantangStudy;},
  },
  yuanyingguan:{
    id:'yuanyingguan',label:'远瀛观',menuLabel:'远瀛观 · 大水法 · 观水法',english:'Yuanyingguan',studyId:'yuanyingguan-dashuifa-guanshuifa-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'animals',sculpturePlaceholder:'选择鹿、猎犬或铜鹤',
    views:{
      front:{label:'南正面 · South elevation',groups:['yuanyingguan'],isolate:['yuanyingguan'],direction:[0,.20,1]},
      threequarter:{label:'斜向全貌 · Three-quarter',groups:[],direction:[.75,.52,1]},
      north:{label:'北背面 · North elevation',groups:['yuanyingguan'],direction:[0,.20,-1]},
      east:{label:'东侧 · East',groups:['yuanyingguan'],direction:[1,.18,0]},
      west:{label:'西侧 · West',groups:['yuanyingguan'],direction:[-1,.18,0]},
      aerial:{label:'俯瞰 · Aerial',groups:[],direction:[.22,1,.24]},
      roof:{label:'五座屋盖 · Five roofs',groups:['yuanyingguan-five-roof-hypothesis'],direction:[.35,.52,1],margin:1.08},
      stone:{label:'柱式石雕 · Carved columns',groups:['south-central-column--2.02','south-central-column-2.02'],isolate:['yuanyingguan'],direction:[.12,.05,1],margin:1.1},
      fountain:{label:'大水法 · Dashuifa',groups:['dashuifa'],direction:[.08,.3,1],margin:1.08},
      animals:{label:'鹿与十犬 · Deer and hounds',groups:['dashuifa-eleven-animal-fountain'],direction:[.08,.45,1],margin:1.1},
      guanshuifa:{label:'观水法 · Guanshuifa',groups:['guanshuifa'],isolate:['guanshuifa'],direction:[0,.25,-1]},
      cranes:{label:'铜鹤双景 · Copper cranes',groups:['guanshuifa-west-copper-crane','guanshuifa-east-copper-crane'],isolate:['guanshuifa'],direction:[0,.25,-1]},
    },
    sculptures:{
      deer:{label:'鹿 · Deer',groups:['dashuifa-deer'],isolate:['dashuifa-deer'],orientationGroup:'dashuifa-deer',direction:[.16,.22,1]},
      ...houndViews,
      'crane-west':{label:'西铜鹤 · West crane',groups:['guanshuifa-west-copper-crane'],isolate:['guanshuifa-west-copper-crane'],orientationGroup:'guanshuifa-west-copper-crane',direction:[.16,.22,1]},
      'crane-east':{label:'东铜鹤 · East crane',groups:['guanshuifa-east-copper-crane'],isolate:['guanshuifa-east-copper-crane'],orientationGroup:'guanshuifa-east-copper-crane',direction:[.16,.22,1]},
    },
    async loadFactory(){const {createYuanyingguanStudy}=await import('./yuanyingguan-study.js');return createYuanyingguanStudy;},
  },
  xieqiqu:{
    id:'xieqiqu',label:'谐奇趣',menuLabel:'谐奇趣 · 曲廊与水法',english:'Xieqiqu',studyId:'xieqiqu-complete-group-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'fountain',sculpturePlaceholder:'选择喷泉雕像',
    views:{
      threequarter:{label:'斜向全貌 · Three-quarter',groups:[],direction:[.75,.5,1]},
      front:{label:'南正面 · South',groups:['xieqiqu-main-hall','xieqiqu-west-curved-gallery','xieqiqu-east-curved-gallery','xieqiqu-west-octagonal-music-pavilion','xieqiqu-east-octagonal-music-pavilion'],direction:[0,.24,1]},
      north:{label:'北背面 · North',groups:['xieqiqu-main-hall','xieqiqu-north-fountain'],direction:[0,.25,-1]},
      east:{label:'东侧 · East',groups:['xieqiqu-main-hall'],isolate:['xieqiqu-main-hall'],direction:[1,.2,0]},
      west:{label:'西侧 · West',groups:['xieqiqu-main-hall'],isolate:['xieqiqu-main-hall'],direction:[-1,.2,0]},
      aerial:{label:'俯瞰 · Aerial',groups:[],direction:[.22,1,.24]},
      roof:{label:'三层主楼 · Main hall',groups:['xieqiqu-main-hall'],isolate:['xieqiqu-main-hall'],direction:[.35,.44,1]},
      gallery:{label:'通透曲廊 · Open arcade',groups:['xieqiqu-west-curved-gallery'],isolate:['xieqiqu-west-curved-gallery'],direction:[.2,.3,1]},
      pavilion:{label:'八角乐亭 · Music pavilion',groups:['xieqiqu-west-octagonal-music-pavilion'],isolate:['xieqiqu-west-octagonal-music-pavilion'],direction:[.7,.32,1]},
      fountain:{label:'南水法 · South fountain',groups:['xieqiqu-south-fountain'],isolate:['xieqiqu-south-fountain'],direction:[.1,.5,1]},
      'north-fountain':{label:'北水法 · North fountain',groups:['xieqiqu-north-fountain'],isolate:['xieqiqu-north-fountain'],direction:[.1,.5,-1]},
      reservoir:{label:'蓄水楼 · Waterworks',groups:['xieqiqu-northwest-reservoir'],isolate:['xieqiqu-northwest-reservoir'],direction:[1,.3,.15]},
    },
    sculptures:{
      fish:{label:'翻尾石鱼 · Upturned stone fish',groups:['xieqiqu-south-upturned-stone-fish-1-body'],isolate:['xieqiqu-south-upturned-stone-fish-1-body'],orientationGroup:'xieqiqu-south-upturned-stone-fish-1',direction:[.8,.18,1]},
      sheep:{label:'铜羊 · Copper sheep',groups:['xieqiqu-south-copper-sheep-1-body'],isolate:['xieqiqu-south-copper-sheep-1-body'],orientationGroup:'xieqiqu-south-copper-sheep-1',direction:[.8,.2,1]},
      swallow:{label:'铜燕 · Copper swallow',groups:['xieqiqu-south-copper-swallow-1-body'],isolate:['xieqiqu-south-copper-swallow-1-body'],orientationGroup:'xieqiqu-south-copper-swallow-1',direction:[.65,.7,1]},
    },
    async loadFactory(){const {createXieqiquStudy}=await import('./xieqiqu-study.js');return createXieqiquStudy;},
  },
  fangwaiguan:{
    id:'fangwaiguan',label:'方外观',menuLabel:'方外观 · 五竹亭',english:'Fangwaiguan',studyId:'fangwaiguan-wuzhuting-study',
    coordinates:{up:'+Y',north:'-Z',east:'+X'},defaultView:'threequarter',sculptureDefaultView:'front',sculpturePlaceholder:'此模型暂无动物雕像',
    views:{
      threequarter:{label:'斜向全貌 · Three-quarter',groups:[],direction:[.75,.5,1]},
      front:{label:'主楼南正面 · South',groups:['fangwaiguan-complete-hall'],isolate:['fangwaiguan-complete-hall'],direction:[0,.2,1]},
      north:{label:'北背面 · North',groups:['fangwaiguan-complete-hall'],isolate:['fangwaiguan-complete-hall'],direction:[0,.2,-1]},
      east:{label:'东侧 · East',groups:['fangwaiguan-complete-hall'],isolate:['fangwaiguan-complete-hall'],direction:[1,.2,0]},
      west:{label:'西侧 · West',groups:['fangwaiguan-complete-hall'],isolate:['fangwaiguan-complete-hall'],direction:[-1,.2,0]},
      aerial:{label:'俯瞰 · Aerial',groups:[],direction:[.22,1,.24]},
      stone:{label:'门窗石雕 · Carved facade',groups:['fangwaiguan-south-front-elevation'],isolate:['fangwaiguan-complete-hall'],direction:[.15,.15,1]},
      roof:{label:'重檐瓦作 · Double eaves',groups:['fangwaiguan-double-eave-blue-green-hipped-roof'],isolate:['fangwaiguan-complete-hall'],direction:[.35,.5,1]},
      stairs:{label:'曲阶 · Curved stair',groups:['fangwaiguan-west-curved-stair'],isolate:['fangwaiguan-complete-hall'],direction:[-.4,.3,1]},
      pavilions:{label:'五亭北正面 · Five pavilions',groups:['wuzhuting-five-linked-pavilions'],isolate:['wuzhuting-five-linked-pavilions'],direction:[0,.15,-1]},
      galleries:{label:'五亭连廊 · Linked galleries',groups:['wuzhuting-five-linked-pavilions'],isolate:['wuzhuting-five-linked-pavilions'],direction:[-.8,.38,-1]},
      water:{label:'水渠与小池 · Canal and pool',groups:['fangwaiguan-water-channel','wuzhuting-front-fountain-basin'],direction:[.3,.9,-1]},
      basin:{label:'圆池内壁 · Basin interior',groups:['wuzhuting-front-fountain-basin'],isolate:['wuzhuting-front-fountain-basin'],direction:[.4,.55,-1]},
    },
    sculptures:{},
    async loadFactory({signal,materialVariant}={}){
      const {createFangwaiguanStudy}=await import('./fangwaiguan-study.js');
      if(!materialVariant)return createFangwaiguanStudy;
      if(materialVariant!=='stone-r4')throw new Error(`Unknown Fangwaiguan material study: ${materialVariant}`);
      const {prepareFangwaiguanMaterialPixels}=await import('./fangwaiguan-materials.js');
      const texturePixels=await prepareFangwaiguanMaterialPixels({signal});return ()=>createFangwaiguanStudy({texturePixels});
    },
  },
};

export function getStudioAsset(id){return typeof id==='string'&&Object.hasOwn(studioAssets,id)?studioAssets[id]:studioAssets.haiyantang;}

export function studioAssetUrl(href,id){
  const url=new URL(href);url.searchParams.set('asset',getStudioAsset(id).id);
  for(const key of ['view','sculpture','specimen','archive','materials'])url.searchParams.delete(key);
  return url.href;
}
