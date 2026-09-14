import {yangquelongGardenViews} from './yangquelong-garden-layout.js';
import {fitGardenCompositionView} from './yangquelong-garden-framing.js';
export const yangquelongGardenStudioEntry={
 id:'yangquelong-garden-r1',label:'养雀笼小庭园 · 当代组合研究',menuLabel:'养雀笼 · 当代小庭园研究',english:'Yangquelong contemporary small garden',
 studyId:'yangquelong-small-garden-composition-r1',coordinates:{up:'+Y',north:'-Z',east:'+X'},
 groundY:-.20,defaultView:'garden',sculptureDefaultView:'garden',sculpturePlaceholder:'请使用完整庭园视角',
 views:yangquelongGardenViews,sculptures:{},
 frameView:fitGardenCompositionView,
 async loadFactory({signal}={}){return (await import('./yangquelong-garden-composition.js')).prepareYangquelongGardenCompositionFactory({signal});},
};
