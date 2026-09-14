// A local study plan in working metres, +X east and +Z south. Only the Sanyouxuan
// spans and platform below are published site measurements. The remaining
// positions, heights and spans are proportional readings of the reproduced plan.
export const hanjingtangSources = [
  { id: 'wang-2015-hanjing-plan', type: 'institutional-study-with-historic-plan-reproductions', title: '王文涛：紫禁城宁寿宫区与长春园含经堂区建筑关系探讨', url: 'https://www.dpm.org.cn/Uploads/File/2020/03/27/u5e7db6f5d6c90.pdf', pages: '359–364', inspected: '16-page PDF; figures 4–6 and 9 actually viewed', limits: 'Reproduced Yangshi Lei and late-period plans constrain topology. Small embedded scans do not yield readable original dimension figures.' },
  { id: 'sun-hanjing-site', type: 'park-site-study', title: '孙晨露：含经堂遗址的展览展示', url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj020/201012/t20101226_229503.html', limits: 'Supports 24 inscription-gallery bays, 144 stone panels, white-marble excavated fragments, interior mezzanine and north-south connections. Approximate whole-zone extents are not global calibration.' },
  { id: 'npm-chunhua-modelbook', type: 'museum-historical-object-catalogue', title: '御製重刻淳化閣帖（一） 冊，故帖000204N000000000', url: 'https://digitalarchive.npm.gov.tw/Collection/Detail/2106?dep=P', limits: '1769 recarving order and 1772 Chunhuaxuan preface; selected low-resolution historic rubbing images are licensed CC0. Page repetition and the rendered stone colour/depth are interpretations.' },
  { id: 'dpm-sanyou-comparison', type: 'comparative-surviving-qianlong-interior', title: '故宫三友轩', url: 'https://www.dpm.org.cn/explore/building/236474.html', limits: 'Different building, built 1774. Motif vocabulary is comparative; its asymmetric hard-gable/hip roof, exact joinery and dimensions are not transferred as Hanjingtang evidence.' },
];

export const hanjingtangPlan = {
  period: 'Qianlong core after the 1768–1772 Chunhuaxuan and Sanyouxuan works; later changes explicitly separated',
  placementGroup: 'hanjingtang',
  localScale: 'working metres; no global georeferencing or surveyed original plan recovered',
  core: [
    { id: 'hanjingtang-main-hall', name: '含经堂', zone: 'south-central', center: [0, 68], width: 29.4, depth: 13.2, bays: 7, floor: 1.02, columnHeight: 6.25, roof: 'double-xieshan', roofRise: 4.4, tile: 'yellowTile', sourceId: 'wang-2015-hanjing-plan' },
    { id: 'hanjingtang-chunhuaxuan', name: '淳化轩', zone: 'north-central', center: [0, 11], width: 33.6, depth: 18.9, bays: 7, depthBays: 3, floor: .90, columnHeight: 8.0, roof: 'juanpeng-xieshan', roofRise: 4.7, tile: 'yellowTile', mezzanine: true, sourceId: 'wang-2015-hanjing-plan' },
    { id: 'hanjingtang-yunzhenzhai', name: '蕴真斋', zone: 'north-central', center: [0, -37], width: 29.4, depth: 9.6, bays: 7, floor: .72, columnHeight: 4.95, roof: 'xieshan', roofRise: 3.6, tile: 'greenTile', baosha: 'front-and-rear', sourceId: 'wang-2015-hanjing-plan', roofTypeEvidence: 'inferred; seven bays and two baosha are supported' },
    { id: 'hanjingtang-sanyouxuan', name: '三友轩', zone: 'west-garden', center: [-34.2, 11], width: 11.1, depth: 7.2, platform: [11.9, 8.3], bays: 3, floor: .54, columnHeight: 3.75, roof: 'juanpeng-xieshan', roofRise: 2.7, tile: 'greenTile', sourceId: 'wang-2015-hanjing-plan', measurements: 'Wang 2015 p364: author reports measurements at this ruin; approximate 11.1 × 7.2 m and 11.9 × 8.3 m platform', roofTypeEvidence: 'inferred small-xuan roof; no transfer of the palace Sanyouxuan asymmetric roof as recovered evidence' },
    { id: 'hanjingtang-hanguangshi', name: '涵光室', zone: 'west-moon-terrace', center: [-33.8, 36], width: 18.0, depth: 8.2, bays: 5, floor: .65, columnHeight: 4.2, roof: 'xieshan', roofRise: 2.9, tile: 'greenTile', sourceId: 'wang-2015-hanjing-plan' },
    { id: 'hanjingtang-yuanyingzhai', name: '渊映斋', zone: 'east-moon-terrace', center: [33.8, 36], width: 18.0, depth: 8.2, bays: 5, floor: .65, columnHeight: 4.2, roof: 'xieshan', roofRise: 2.9, tile: 'greenTile', sourceId: 'wang-2015-hanjing-plan' },
    { id: 'hanjingtang-west-front-wing', name: '西配殿', zone: 'south-west', center: [-34.8, 94], width: 17.5, depth: 7.4, bays: 5, floor: .64, columnHeight: 4.0, roof: 'xieshan', roofRise: 2.7, tile: 'greyTile', rotation: Math.PI / 2, sourceId: 'wang-2015-hanjing-plan', bayEvidence: 'placement supported; five-bay subdivision inferred' },
    { id: 'hanjingtang-east-front-wing', name: '东配殿', zone: 'south-east', center: [34.8, 94], width: 17.5, depth: 7.4, bays: 5, floor: .64, columnHeight: 4.0, roof: 'xieshan', roofRise: 2.7, tile: 'greyTile', rotation: -Math.PI / 2, sourceId: 'wang-2015-hanjing-plan', bayEvidence: 'placement supported; five-bay subdivision inferred' },
    { id: 'hanjingtang-fanxianglou', name: '梵香楼', zone: 'south-west', center: [-35.3, 68], width: 13.2, depth: 8.0, bays: 3, floor: .74, columnHeight: 3.7, roof: 'xieshan', roofRise: 3.0, tile: 'greenTile', storeys: 2, sourceId: 'wang-2015-hanjing-plan', massingEvidence: 'paired named towers supported; upper-storey proportions inferred' },
    { id: 'hanjingtang-xiazhulou', name: '霞翥楼', zone: 'south-east', center: [35.3, 68], width: 13.2, depth: 8.0, bays: 3, floor: .74, columnHeight: 3.7, roof: 'xieshan', roofRise: 3.0, tile: 'greenTile', storeys: 2, sourceId: 'wang-2015-hanjing-plan', massingEvidence: 'paired named towers supported; upper-storey proportions inferred' },
  ],
  gates: { south: { center: [0, 116], bays: 5, platformWidth: 19.7, platformHeight: 1.6, measuredEvidence: 'reported platform length and height in Sun site study; depth and reconstructed semicircular profile inferred' }, north: { center: [0, -66], bays: 3, evidence: 'north gate supported; bay count inferred' } },
  galleries: { bayCount: 24, panelCount: 144, sides: [-22.2, 22.2], fromZ: 60, toZ: 23, width: 3.2, evidence: '24 bays and 144 panels supported; 12 equal bays per side and six panels per bay are a proportional presentation' },
  boundary: { west: -47.5, east: 47.5, north: -67, south: 117, evidence: 'authored enclosure fitted to the reproduced plan, not surveyed' },
  deferredNorthSides: [
    { name: '静莲斋', relation: 'north of Sanyouxuan', bays: 5, roof: 'xieshan' },
    { name: '理心楼', relation: 'north of Jinglianzhai and west of Yunzhenzhai', bays: 5 },
    { name: '待月楼', relation: 'west of Sanyouxuan', bays: 3, storeys: 2, facing: 'east', roof: 'xieshan' },
    { name: '澄波夕照', relation: 'outside west wall at waterside mountain opening', bays: 3, facing: 'west', openHall: true },
    { name: '扮戏房、乐奏钧天、神心妙达', relation: 'east route north of Yuanyingzhai', phase: '1814 theatre alterations require separate plan registration; not silently added to the Qianlong core' },
  ],
};
