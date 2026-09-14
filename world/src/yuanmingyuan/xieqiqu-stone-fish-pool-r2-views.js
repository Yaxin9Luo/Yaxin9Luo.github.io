import {stoneFishPoolStudyViews} from './xieqiqu-stone-fish-pool-views.js';

export const stoneFishPoolR2StudyId='xieqiqu-stone-fish-pool-r2';
export const stoneFishPoolR2StudyViews=Object.freeze({
  ...stoneFishPoolStudyViews,
  impact:{label:'落水近景 · Impact detail',groups:['xieqiqu-south-upturned-stone-fish-1-landing-splash'],orientationGroup:'xieqiqu-south-upturned-stone-fish-1',direction:[1,1.5,1],margin:4},
  waves:{label:'卷浪石座 · Carved wave support',groups:['xieqiqu-south-upturned-stone-fish-1-wave-plinth'],orientationGroup:'xieqiqu-south-upturned-stone-fish-1',direction:[1,.20,.35],margin:1.16},
  rim:{label:'海棠池沿石材 · Pool coping',groups:['xieqiqu-south-haitang-pool'],direction:[.8,.52,1],crop:{min:[.77,.58,.45],max:[1,1,.93]},margin:1.12},
});
