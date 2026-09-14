import {frameYangquelongUnderstoreyStudy} from './yangquelong-understorey-framing.js';
import {fitGardenCompositionView} from './yangquelong-garden-framing.js';
import {yangquelongGardenViews} from './yangquelong-garden-layout.js';
import {yangquelongUnderstoreyStudyViews} from './yangquelong-understorey-study.js';
export const yangquelongUnderstoreyStudioEntry={
 id:'yangquelong-understorey-bed-r5',label:'养雀笼低植被 · 完整床部件',menuLabel:'养雀笼 · 低植被床研究',english:'Yangquelong contemporary understorey bed',
 studyId:'yangquelong-understorey-bed-study-r5',coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:-.20,
 defaultView:'bed',sculptureDefaultView:'bed',sculpturePlaceholder:'完整种植床视角',views:yangquelongUnderstoreyStudyViews,sculptures:{},frameView:frameYangquelongUnderstoreyStudy,
 async loadFactory({signal}={}){return (await import('./yangquelong-understorey-study.js')).prepareYangquelongUnderstoreyStudyFactory({signal});},
};
export const yangquelongPlantedGardenStudioEntry={
 id:'yangquelong-planted-garden-r1',label:'养雀笼 · 当代种植组合候选',menuLabel:'养雀笼 · 完整种植组合研究',english:'Yangquelong planted garden candidate',
 studyId:'yangquelong-planted-garden-r1',coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:-.20,
 defaultView:'garden',sculptureDefaultView:'garden',sculpturePlaceholder:'完整庭园视角',views:yangquelongGardenViews,sculptures:{},frameView:fitGardenCompositionView,
 async loadFactory({signal}={}){return (await import('./yangquelong-planted-garden.js')).prepareYangquelongPlantedGardenFactory({signal});},
};
