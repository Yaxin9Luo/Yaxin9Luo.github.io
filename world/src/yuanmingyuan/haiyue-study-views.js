// Pure framing data; catalogue import must not construct or load the asset.
export const haiyueViews = {
  threequarter: { label: '海岳开襟 · 咸丰晚期双圆台', groups: [], direction: [-1, .60, .85], margin: 1.12 },
  aerial: { label: '晚期五座建筑 · 四向登临', groups: [], direction: [.12, 1, .14], margin: 1.10 },
  main: { label: '三层正楼 · 四面廊与十字脊', groups: ['haiyue-main-pavilion'], isolate: ['haiyue-main-pavilion'], direction: [-.70, .36, 1], margin: 1.13 },
  mainWest: { label: '西面登楼 · 檐廊层次', groups: ['haiyue-main-pavilion'], isolate: ['haiyue-main-pavilion'], direction: [-1, .22, .18], margin: 1.12 },
  mainRoof: { label: '顶层十字脊 · 绿剪边瓦作', groups: ['haiyue-main-top-roof'], isolate: ['haiyue-main-top-roof'], direction: [.78, .85, 1], margin: 1.12 },
  mainJoinery: { label: '正楼底层 · 外廊、菱棂与花板', groups: ['haiyue-main-level-1'], isolate: ['haiyue-main-level-1'], direction: [.48, .14, 1], margin: 1.12 },
  stairs: { label: '两段转折木梯 · 楼板洞口与护栏', groups: ['haiyue-main-stairs', 'haiyue-main-floor-2', 'haiyue-main-floor-3'], isolate: ['haiyue-main-stairs', 'haiyue-main-floor-2', 'haiyue-main-floor-3'], direction: [-1, .72, .80], crop: { min: [.10, 0, .18], max: [.46, 1, .86] }, margin: 1.12 },
  floorStair: { label: '顶层梯洞 · 出口、护栏与转折平台', groups: ['haiyue-main-floor-3', 'haiyue-stair-to-floor-3'], isolate: ['haiyue-main-floor-3', 'haiyue-stair-to-floor-3'], direction: [-1, 1.25, .70], crop: { min: [0, 0, .12], max: [.47, 1, .95] }, margin: 1.14 },
  southHall: { label: '林渊锦镜 · 五间穿堂与三间抱厦', groups: ['haiyue-linyuan-jinjing'], isolate: ['haiyue-linyuan-jinjing'], direction: [.64, .41, 1], margin: 1.13 },
  northHall: { label: '秀挹岑清 · 外廊与北向抱厦', groups: ['haiyue-xiuyi-cenqing'], isolate: ['haiyue-xiuyi-cenqing'], direction: [-.55, .40, -1], margin: 1.13 },
  eastHall: { label: '东配殿 · 三间重檐推定', groups: ['haiyue-east-hall'], isolate: ['haiyue-east-hall'], direction: [-1, .42, .6], margin: 1.13 },
  dock: { label: '西码头 · 白石登岸与栏杆缺口', groups: ['haiyue-west-dock', 'haiyue-west-terrace-stair'], isolate: ['haiyue-west-dock', 'haiyue-west-terrace-stair'], direction: [-1, .43, .45], margin: 1.13 },
  marble: { label: '汉白玉栏杆 · 实体雕纹与石缝', groups: ['haiyue-rail-study'], isolate: ['haiyue-rail-study'], direction: [.26, .25, 1], margin: 1.13 },
};
