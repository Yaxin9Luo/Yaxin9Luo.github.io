import {stoneFishPoolR3StudyViews} from './xieqiqu-stone-fish-pool-r3-views.js';

export const stoneFishPoolR4StudyId='xieqiqu-stone-fish-pool-r4';
const support='xieqiqu-south-upturned-stone-fish-1-wave-plinth',fish='xieqiqu-south-upturned-stone-fish-1';
export const stoneFishPoolR4StudyViews=Object.freeze({
  ...stoneFishPoolR3StudyViews,
  'wave-mass':{label:'厚浪面承托 · Folded wave masses',groups:[support],orientationGroup:fish,direction:[1,.20,.55],margin:1.14},
  'wave-waterline':{label:'浪根与水线 · Wave roots at waterline',groups:[support],orientationGroup:fish,direction:[1,.045,.18],crop:{min:[0,.22,0],max:[1,.73,1]},margin:1.14},
});
