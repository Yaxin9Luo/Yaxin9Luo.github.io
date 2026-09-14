import {stoneFishPoolR2StudyViews} from './xieqiqu-stone-fish-pool-r2-views.js';

export const stoneFishPoolR3StudyId='xieqiqu-stone-fish-pool-r3';
const support='xieqiqu-south-upturned-stone-fish-1-wave-plinth',fish='xieqiqu-south-upturned-stone-fish-1';
export const stoneFishPoolR3StudyViews=Object.freeze({
  ...stoneFishPoolR2StudyViews,
  'wave-side':{label:'回卷侧向净空 · Wave side opening',groups:[support],orientationGroup:fish,direction:[1,.12,.10],margin:1.14},
  'wave-oblique':{label:'卷浪连接 · Joined wave roots',groups:[support],orientationGroup:fish,direction:[.75,.28,1],margin:1.15},
  'wave-end':{label:'端部回卷 · End return',groups:[support],orientationGroup:fish,direction:[.05,.14,1],margin:1.14},
});
