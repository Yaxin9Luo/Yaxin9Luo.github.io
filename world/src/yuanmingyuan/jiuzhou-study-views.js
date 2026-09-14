// Pure Studio data: importing these presets constructs no geometry or texture.
export const jiuzhouStudyViews = {
  threequarter: { label: '九洲清晏核心院落 · Jiuzhou courts', groups: [], direction: [.64, .69, 1] },
  aerial: { label: '三路院落与岛岸 · Three routes and shore', groups: [], direction: [.04, 1, .08] },
  front: { label: '圆明园殿与前院 · Yuanmingyuan Hall', groups: ['jiuzhou-yuanmingyuan-hall', 'jiuzhou-south-axis-forecourt'], direction: [.38, .39, 1] },
  'shared-roof': { label: '九洲连卷共檩 · Joined rounded roofs', groups: ['jiuzhou-qingyan-hall-roof'], isolate: ['jiuzhou-qingyan-hall'], direction: [.82, .52, -.60], margin: 1.12 },
  'roof-tiles': { label: '灰筒瓦与板瓦搭接 · Clay tile courses', groups: ['jiuzhou-qingyan-hall-roof-common-purlin-central-roof'], isolate: ['jiuzhou-qingyan-hall'], crop: { min: [.34, .03, .76], max: [.56, .43, .98] }, direction: [.30, .74, 1], margin: 1.12 },
  joinery: { label: '前檐玻璃支摘窗 · Front glazed windows', groups: ['jiuzhou-qingyan-front-zhizhai-facade'], isolate: ['jiuzhou-qingyan-hall'], direction: [.08, .025, 1], margin: 1.10 },
  'rear-joinery': { label: '后抱厦绿油支摘窗 · Rear addition windows', groups: ['jiuzhou-qingyan-rear-zhizhai-facade'], isolate: ['jiuzhou-qingyan-hall'], direction: [-.10, .06, -1], margin: 1.11 },
  'suite-links': { label: '同道堂与清晖堂内侧套殿 · Connecting suites', groups: ['jiuzhou-late-three-bay-connecting-suites'], isolate: ['jiuzhou-late-three-bay-connecting-suites', 'jiuzhou-qingyan-hall', 'jiuzhou-tongdaotang', 'jiuzhou-qinghuitang'], direction: [.15, .85, -1], margin: 1.16 },
  paintwork: { label: '前檐和玺梁枋 · Front hexi paintwork', groups: ['jiuzhou-qingyan-hall-front-eave-row'], isolate: ['jiuzhou-qingyan-hall'], crop: { min: [.35, .75, .15], max: [.65, 1, 1] }, direction: [.02, -.12, 1], margin: 1.12 },
  framing: { label: '共檩与抬梁构架 · Purlins and raised beams', groups: ['jiuzhou-qingyan-hall-timber-frame'], isolate: ['jiuzhou-qingyan-hall-timber-frame'], direction: [.68, .36, -.8], margin: 1.13 },
  theatre: { label: '同道堂与倒座戏台 · Tongdao theatre court', groups: ['jiuzhou-tongdaotang', 'jiuzhou-tongdao-stage', 'jiuzhou-tongdao-dressing'], direction: [.72, .52, -.85] },
  'stage-roof': { label: '戏台重檐与上歇山 · Theatre double eaves', groups: ['jiuzhou-tongdao-stage'], isolate: ['jiuzhou-tongdao-stage'], direction: [.64, .40, -.95], margin: 1.12 },
  western: { label: '慎德堂三卷与三亭斋 · Western ensemble', groups: ['jiuzhou-shendetang', 'jiuzhou-dexinxumiao', 'jiuzhou-zhaoyinjing', 'jiuzhou-qiaobi'], direction: [-.60, .76, 1] },
  eastern: { label: '天地一家春与泉石自娱 · Eastern residential courts', groups: ['jiuzhou-tiandiyijiachun', 'jiuzhou-tiandi-rear-hall', 'jiuzhou-quanshiziyu', 'jiuzhou-tiandi-palace-gate', 'jiuzhou-tiandi-west-wing', 'jiuzhou-tiandi-east-wing'], direction: [.57, .75, 1] },
  corner: { label: '西北转角楼 · Northwest corner house', groups: ['jiuzhou-west-corner-house'], isolate: ['jiuzhou-west-corner-house'], direction: [.90, .62, 1], margin: 1.12 },
  'corner-stair': { label: '转角楼实际梯洞 · Corner stair opening', groups: ['jiuzhou-west-corner-house-upper-floor-with-actual-stair-opening', 'jiuzhou-west-corner-house-two-flight-stair'], isolate: ['jiuzhou-west-corner-house-upper-floor-with-actual-stair-opening', 'jiuzhou-west-corner-house-two-flight-stair'], direction: [.70, .64, 1], margin: 1.13 },
  gallery: { label: '晚期廊道与承托 · Late covered gallery', groups: ['jiuzhou-gallery-central-rear-west-segment-1-bay-0'], isolate: ['jiuzhou-gallery-central-rear-west-segment-1-bay-0', 'jiuzhou-gallery-central-rear-west-continuous-roof'], direction: [1, .20, .40], margin: 1.16 },
  ruyi: { label: '如意桥石梁与木板 · Ruyi Bridge', groups: ['jiuzhou-ruyi-bridge'], isolate: ['jiuzhou-ruyi-bridge'], direction: [1, .53, .65], margin: 1.12 },
  'ruyi-carving': { label: '如意桥双面透雕 · Pierced bridge rail', groups: ['jiuzhou-ruyi-carved-wood-rail-1'], isolate: ['jiuzhou-ruyi-bridge'], crop: { min: [0, .15, .30], max: [1, 1, .56] }, direction: [1, .04, .10], margin: 1.14 },
};

// Each set references only nodes actually built by its section factory.
export const jiuzhouSectionStudyViews = {
  central: {
    threequarter: { ...jiuzhouStudyViews.threequarter, label: '中路三殿与戏院 · Central halls and theatre' },
    aerial: jiuzhouStudyViews.aerial,
    front: { ...jiuzhouStudyViews.front, groups: ['jiuzhou-yuanmingyuan-hall'] },
    'shared-roof': jiuzhouStudyViews['shared-roof'], 'roof-tiles': jiuzhouStudyViews['roof-tiles'],
    joinery: jiuzhouStudyViews.joinery, 'rear-joinery': jiuzhouStudyViews['rear-joinery'],
    'suite-links': jiuzhouStudyViews['suite-links'],
    paintwork: jiuzhouStudyViews.paintwork, framing: jiuzhouStudyViews.framing,
    theatre: jiuzhouStudyViews.theatre, 'stage-roof': jiuzhouStudyViews['stage-roof'], gallery: jiuzhouStudyViews.gallery,
  },
  western: {
    threequarter: { ...jiuzhouStudyViews.threequarter, label: '西路寝殿与园居 · Western residential courts' },
    aerial: jiuzhouStudyViews.aerial, western: jiuzhouStudyViews.western,
    corner: jiuzhouStudyViews.corner, 'corner-stair': jiuzhouStudyViews['corner-stair'],
  },
  eastern: {
    threequarter: { ...jiuzhouStudyViews.threequarter, label: '东路天地一家春 · Eastern residential courts' },
    aerial: jiuzhouStudyViews.aerial, eastern: jiuzhouStudyViews.eastern,
  },
  waterfront: {
    threequarter: { ...jiuzhouStudyViews.threequarter, label: '岛岸与如意桥 · Shore and Ruyi Bridge' },
    aerial: jiuzhouStudyViews.aerial, ruyi: jiuzhouStudyViews.ruyi, 'ruyi-carving': jiuzhouStudyViews['ruyi-carving'],
  },
};
