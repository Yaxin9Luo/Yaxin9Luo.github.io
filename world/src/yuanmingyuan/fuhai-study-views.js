// Subject-to-camera world vectors, matching studio-assets.js. These are static
// review presets; the factories above remain unchanged by studio integration.
export const fuhaiStudyViews = {
  fanghu: {
    threequarter: { label: '三进九楼 · Three courts', groups: [], direction: [.72, .62, 1] },
    front: { label: '临水正面 · Waterfront front', groups: ['fanghu-nine-rear-halls', 'fanghu-three-front-double-eave-pavilions', 'fanghu-shan-shaped-white-stone-terraces'], direction: [0, .29, 1] },
    aerial: { label: '院落俯瞰 · Courts above', groups: [], direction: [.18, 1, .22] },
    roof: { label: '重檐与搭瓦 · Roof and tile laps', groups: ['fanghu-front-central-pavilion-roof'], isolate: ['fanghu-front-central-pavilion'], direction: [.35, .52, 1], margin: 1.08 },
    hall: { label: '后殿楼阁 · Rear hall', groups: ['fanghu-row-3-central-hall'], isolate: ['fanghu-row-3-central-hall'], direction: [.30, .26, 1] },
    dougong: { label: '彩画斗拱 · Painted brackets', groups: ['fanghu-front-central-pavilion-lower-frame-columns-and-beams'], isolate: ['fanghu-front-central-pavilion'], direction: [.14, -.18, 1], crop: { min: [.36, .69, .82], max: [.79, 1, 1] }, margin: 1.12 },
    'cross-roof': { label: '凝祥亭十字脊 · Cross-ridged roof', groups: ['fanghu-front-west-pavilion-roof'], isolate: ['fanghu-front-west-pavilion'], direction: [-.55, .52, 1], margin: 1.10 },
    joinery: { label: '红格扇与彩画 · Joinery and paintwork', groups: ['fanghu-row-1-central-hall-lower-frame'], isolate: ['fanghu-row-1-central-hall'], direction: [.15, -.03, 1], crop: { min: [.48, 0, .74], max: [1, 1, 1] }, margin: 1.10 },
    carving: { label: '白石莲纹 · Carved lotus frieze', groups: ['fanghu-promontory-carved-stonework'], direction: [.38, .16, 1], crop: { min: [.49, .1, .78], max: [.60, 1, 1] }, margin: 1.14 },
    terrace: { label: '白石台阶 · Landing and stonework', groups: ['fanghu-central-boat-landing'], direction: [-.50, .30, 1] },
    gallery: { label: '临水连廊 · Waterside gallery', groups: ['fanghu-west-water-pavilion-link', 'fanghu-front-west-pavilion'], isolate: ['fanghu-west-water-pavilion-link', 'fanghu-front-west-pavilion'], direction: [-.75, .28, 1] },
  },
  pengdao: {
    threequarter: { label: '三岛全貌 · Three islands', groups: [], direction: [.68, .58, 1] },
    front: { label: '主岛正面 · Main island front', groups: ['pengdao-main-island-courtyard', 'pengdao-main'], direction: [0, .27, 1] },
    aerial: { label: '岛桥俯瞰 · Islands and bridges', groups: [], direction: [.15, 1, .20] },
    gate: { label: '镜中阁 · Jingzhongge', groups: ['pengdao-jingzhongge'], isolate: ['pengdao-jingzhongge'], direction: [.25, .23, 1] },
    roof: { label: '两卷殿顶 · Joined hall roofs', groups: ['pengdao-seven-bay-two-juan-hall-roof'], isolate: ['pengdao-seven-bay-two-juan-hall'], direction: [.52, .67, 1] },
    dougong: { label: '阁楼斗拱 · Loft brackets', groups: ['pengdao-jingzhongge-loft-loft-dougong-face-1'], isolate: ['pengdao-jingzhongge'], direction: [.17, -.06, 1], margin: 1.12 },
    terrace: { label: '舟行登岸 · Boat landing', groups: ['pengdao-south-boat-landing'], direction: [-.45, .30, 1] },
    bridges: { label: '三岛双桥 · Island bridges', groups: ['pengdao-two-island-bridges'], direction: [.32, .78, 1] },
    'west-bridge': { label: '西岛桥 · West bridge', groups: ['pengdao-west-bridge'], isolate: ['pengdao-west-bridge', 'pengdao-west', 'pengdao-main'], direction: [-.25, .42, 1] },
    'east-pavilion': { label: '瀛海仙山亭 · Eastern pavilion', groups: ['pengdao-yinghai-xianshan-pavilion'], isolate: ['pengdao-yinghai-xianshan-pavilion', 'pengdao-east'], direction: [.52, .28, 1] },
  },
};
