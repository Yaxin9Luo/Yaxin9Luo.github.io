import {WANFANG_ANHE_ID} from './wanfang-anhe-layout.js';
export const wanfangAnheStudioEntry={
  id:'wanfang-anhe',label:'万方安和 · 33 间水殿研究',menuLabel:'万方安和 · 连通水殿候选',
  english:'Wanfang Anhe connected water palace study',studyId:WANFANG_ANHE_ID,
  coordinates:{up:'+Y',north:'-Z',east:'+X'},groundY:-1.84,defaultView:'overview',
  sculptureDefaultView:'overview',sculpturePlaceholder:'请使用建筑视角',sculptures:{},
  views:{
    overview:{label:'完整 33 间与水院 · Overview',groups:['wanfang-anhe-complete-architecture'],direction:[1,.92,1.32],margin:1.12},
    'roof-junction':{label:'中央卷棚交接 · Roof junction',groups:['wanfang-anhe-connected-roof'],direction:[1,1.05,1.3],margin:1.06,
      camera:[12.8,16.5,17.2],target:[0,5.5,0]},
    'veranda-waterline':{label:'外廊与临水石基 · Veranda waterline',groups:['wanfang-anhe-complete-architecture'],direction:[.2,.13,1],margin:1.1,
      camera:[7.7,3.6,29.3],target:[7.7,2.7,20.4]}
  },
  frameView({camera,controls,spec}){
    if(!spec.camera)return;
    camera.position.set(...spec.camera);controls.target.set(...spec.target);controls.update();camera.updateMatrixWorld(true);
  },
  async loadFactory({signal}={}){
    signal?.throwIfAborted();
    const {createWanfangAnheStudy}=await import('./wanfang-anhe-study.js');
    signal?.throwIfAborted();
    return ()=>{signal?.throwIfAborted();return createWanfangAnheStudy({signal});};
  }
};
