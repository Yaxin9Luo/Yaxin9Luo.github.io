// Pure subject-to-camera specifications; no renderer, factory or registration.
export const xianfashanStudyViews = {
  threequarter: { label: '线法山 · Hill and gateways', groups: [], direction: [-1, .49, .70] },
  front: { label: '线法山正面 · Historic hill front', groups: ['xianfashan-complete-earth-mound', 'xianfashan-continuous-winding-route', 'xianfashan-summit-pavilion', 'xianfashan-foot-gateposts'], direction: [-1, .16, .05] },
  aerial: { label: '盘道与山脚通路 · Ascent and ground bypass', groups: ['xianfashan-complete-earth-mound', 'xianfashan-continuous-winding-route', 'xianfashan-ground-approaches'], direction: [.12, 1, .05], margin: 1.08 },
  'west-gate': { label: '线法山门正面 · West gate', groups: ['xianfashan-west-gate'], isolate: ['xianfashan-west-gate', 'xianfashan-west-enclosure-walls'], direction: [-1, .12, .05], margin: 1.12 },
  'east-gate': { label: '线法山东门 · East gate', groups: ['xianfashan-east-gate'], isolate: ['xianfashan-east-gate'], direction: [1, .09, .02] },
  pavilion: { label: '双檐八角亭 · Double-roof octagonal pavilion', groups: ['xianfashan-summit-pavilion'], isolate: ['xianfashan-summit-pavilion'], direction: [-1, .30, .62] },
  passage: { label: '山顶亭四券 · Four open portals', groups: ['xianfashan-pavilion-four-open-portals', 'xianfashan-summit-platform'], isolate: ['xianfashan-summit-pavilion'], direction: [-1, .02, .02], margin: 1.06 },
  'ramp-detail': { label: '琉璃矮墙盘道 · Glazed parapet and stone ramp', groups: ['xianfashan-continuous-winding-route'], direction: [-1, .32, .55], crop: { min: [0, 0, .35], max: [.35, .42, .70] }, margin: 1.04 },
};

export const fangheXianfahuaStudyViews = {
  threequarter: { label: '方河与线法画 · Basin and scenic wings', groups: [], direction: [-1, .52, .46] },
  front: { label: '湖西东望 · Perspective from the west bank', groups: ['xianfahua-shallow-perspective-scenery'], direction: [-1, .045, 0], margin: 1.05 },
  aerial: { label: '断墙收分 · Tapering stage layout', groups: ['xianfahua-shallow-perspective-scenery', 'xianfahua-east-water-landing'], direction: [.06, 1, .04] },
  side: { label: '画墙真实厚度 · Shallow scenic walls', groups: ['xianfahua-shallow-perspective-scenery'], isolate: ['xianfahua-shallow-perspective-scenery', 'xianfahua-bank-paving'], direction: [.45, .26, 1] },
  rear: { label: '布景背面 · Plain wall backs', groups: ['xianfahua-shallow-perspective-scenery'], isolate: ['xianfahua-shallow-perspective-scenery'], direction: [1, .28, -.40] },
  'paint-detail': { label: '绘景与拱框 · Painted scenery and arch frame', groups: ['xianfahua-wing-south-1', 'xianfahua-wing-south-2'], isolate: ['xianfahua-shallow-perspective-scenery'], direction: [-1, .12, .30] },
  landing: { label: '石阶入水 · Semicircular water landing', groups: ['xianfahua-east-water-landing'], isolate: ['xianfahua-fanghe-basin', 'xianfahua-bank-paving'], direction: [-1, .62, .42], margin: 1.10 },
};

export const xianfaqiaoStudyViews = {
  threequarter: { label: '线法桥与西洋门 · Bridge sluice and screen gate', groups: [], direction: [.38, .27, 1] },
  front: { label: '五孔闸与雕屏 · Photographed elevation', groups: ['xianfaqiao-five-opening-sluice', 'xianfaqiao-european-screen-and-central-gate'], direction: [0, .08, 1] },
  gate: { label: '中央门饰 · Central gateway carving', groups: ['xianfaqiao-european-screen-and-central-gate'], direction: [.04, .08, 1], crop: { min: [.32, .08, 0], max: [.68, 1, 1] } },
  rear: { label: '背面推定 · Unresolved rear completion', groups: ['xianfaqiao-european-screen-and-central-gate', 'xianfaqiao-five-opening-sluice'], direction: [.26, .20, -1] },
  sluice: { label: '闸孔与水位 · Five waterways', groups: ['xianfaqiao-five-opening-sluice', 'xianfaqiao-study-water-channel'], direction: [.09, .02, 1] },
  passage: { label: '门洞净空 · Central through-door', groups: ['xianfaqiao-european-screen-and-central-gate'], direction: [0, .04, 1], crop: { min: [.40, .03, 0], max: [.60, .59, 1] } },
  'deck-join-positive': { label: '桥面正X端接头 · Positive-X paving joint', groups: ['xianfaqiao-five-opening-sluice', 'xianfaqiao-study-grounded-abutments'], direction: [.26, .60, 1], crop: { min: [.835, .88, .57], max: [.975, 1, 1] }, margin: 1.12 },
  'deck-join-negative': { label: '桥面负X端接头 · Negative-X paving joint', groups: ['xianfaqiao-five-opening-sluice', 'xianfaqiao-study-grounded-abutments'], direction: [-.26, .60, -1], crop: { min: [.025, .88, 0], max: [.165, 1, .43] }, margin: 1.12 },
};
