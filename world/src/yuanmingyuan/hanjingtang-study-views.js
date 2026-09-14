// Pure data: importing studio presets never constructs a palace or loads images.
export const hanjingtangStudyViews = {
  threequarter: { label: '含经堂院落 · Hanjingtang courts', groups: [], direction: [.65, .66, 1] },
  aerial: { label: '中路与东西路 · Three-route plan', groups: [], direction: [.12, 1, .10] },
  front: { label: '宫门与前院 · South palace court', groups: ['hanjingtang-south-palace-gate', 'hanjingtang-main-hall', 'hanjingtang-south-court-spirit-screen'], direction: [.34, .44, 1] },
  'double-roof': { label: '含经堂重檐歇山 · Double xieshan', groups: ['hanjingtang-main-hall-roof'], isolate: ['hanjingtang-main-hall'], direction: [.55, .54, 1], margin: 1.10 },
  'rolled-roof': { label: '淳化轩卷棚顶 · Rounded crown', groups: ['hanjingtang-chunhuaxuan-roof'], isolate: ['hanjingtang-chunhuaxuan'], direction: [.72, .56, 1], margin: 1.10 },
  dougong: { label: '檐下彩画斗拱 · Painted bracket work', groups: ['hanjingtang-main-hall-lower-frame-columns-brackets-beams'], isolate: ['hanjingtang-main-hall'], direction: [.16, -.20, 1], crop: { min: [.43, .70, .83], max: [.72, 1, 1] }, margin: 1.13 },
  inscriptions: { label: '淳化阁帖碑廊 · Modelbook stone gallery', groups: ['hanjingtang-west-inscription-gallery-marble-inscriptions'], isolate: ['hanjingtang-west-inscription-gallery'], direction: [1, .025, .22], crop: { min: [0, 0, .35], max: [1, 1, .52] }, margin: 1.15 },
  mezzanine: { label: '淳化轩仙楼剖看 · Interior mezzanine', groups: ['hanjingtang-chunhua-interior-mezzanine'], isolate: ['hanjingtang-chunhua-interior-mezzanine'], direction: [.50, .62, 1], margin: 1.1 },
  sanyou: { label: '三友轩与叠石 · Sanyouxuan garden', groups: ['hanjingtang-sanyouxuan'], isolate: ['hanjingtang-sanyouxuan', 'hanjingtang-scholar-rock-gardens'], direction: [-.62, .34, 1] },
  carving: { label: '松竹梅圆光罩 · Carved circular screen', groups: ['hanjingtang-sanyou-circular-screen'], isolate: ['hanjingtang-sanyou-interior'], direction: [1, .08, .18], margin: 1.13 },
  water: { label: '得胜概临水 · Northern waterside hall', groups: ['hanjingtang-north-waterside-approach'], isolate: ['hanjingtang-north-waterside-approach'], direction: [-.52, .34, -1] },
  paifang: { label: '南广场三牌楼 · Three glazed archways', groups: ['hanjingtang-south-square-three-glazed-paifang'], isolate: ['hanjingtang-south-square-three-glazed-paifang'], direction: [.64, .50, 1] },
};
