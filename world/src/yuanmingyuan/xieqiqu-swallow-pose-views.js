// Pure registry data: no Three, material, geometry, or factory dependencies.
export const copperSwallowPoseStudyId='xieqiqu-copper-swallow-pose-r1';
export const copperSwallowPoseStudyViews=Object.freeze({
  threequarter:{label:'短足展翼铜鸟 · Authored copper bird',groups:[],direction:[.65,.60,1]},
  profile:{label:'完整颈胸与屈足 · Neck, breast and stance',groups:[],direction:[1,.04,.20]},
  front:{label:'肩部与双足 · Shoulders and feet',groups:[],direction:[.04,.08,1]},
  top:{label:'肘腕与飞羽 · Elbow, wrist and feather fan',groups:[],direction:[.02,1,.04]},
  head:{label:'保留的喷嘴与尖喙 · Retained fountain beak',groups:[],direction:[.4,.20,1],crop:{min:[.36,.52,.63],max:[.64,1,1]}},
  wingfold:{label:'翼根与腕部折面 · Wing root and wrist',groups:[],direction:[.45,.30,1],crop:{min:[.49,.37,.15],max:[1,1,.84]}},
  feet:{label:'真实足底与屈跗 · Bent tarsus and contact',groups:[],direction:[.6,.16,1],crop:{min:[.41,0,.60],max:[.63,.48,.83]}},
});
