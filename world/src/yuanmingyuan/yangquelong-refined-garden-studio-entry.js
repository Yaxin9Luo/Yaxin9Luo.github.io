import {yangquelongRefinedGardenViews,frameYangquelongRefinedGarden} from './yangquelong-refined-garden-views.js';
export const yangquelongRefinedGardenStudioEntry={
 id:'yangquelong-refined-garden-r3',label:'养雀笼庭园 · 铺地与花床组合研究',menuLabel:'养雀笼 · 当代庭园组合研究',english:'Yangquelong contemporary garden refinement',
 studyId:'yangquelong-refined-garden-r3',coordinates:{up:'+Y',north:'-Z',east:'+X'},
 groundY:-.20,defaultView:'gardenhigh',sculptureDefaultView:'gardenhigh',sculpturePlaceholder:'请使用全景或庭院近景',
 views:yangquelongRefinedGardenViews,sculptures:{},frameView:frameYangquelongRefinedGarden,
 async loadFactory({signal}={}){return (await import('./yangquelong-refined-garden.js')).prepareYangquelongRefinedGardenFactory({signal});},
};
