// Pure study coordinates: +X east, +Z south, in working metres. These coordinates
// are NOT a surveyed Qing plan or a registration to the three-garden world map.
export const zhengjuesiSources = [
  { id: 'park-zhengjuesi', title: '圆明园管理处 · 正觉寺', url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/qcy/201101/t20110105_231479.html', date: '2011-01-05', type: 'official-site-description', use: '1773; independent south entrance and north garden connection; bays and surviving buildings', limit: 'The photograph shows repaired fabric. The page does not supply a dimensioned pre-1860 survey.' },
  { id: 'qi-zhang-2021', title: '祁爽、张凤梧 · 浅议圆明园正觉寺与承德殊像寺的建筑', url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202112/t20211202_4499071.html', date: '2021-12-02', type: 'institutional-architectural-research', use: 'Figure 3-1, table 3-1, figure 3-5; five axial buildings, flat courts, roof forms and approximately 65 m main-court width', limit: 'The plan is a modern redrawing of the Beijing heritage institute reconstruction plan; no original Yangshi Lei sheet has been inspected.' },
  { id: 'wu-zhengjuesi', title: '吴凤春 · 藏传佛教与圆明园正觉寺', url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj005/201012/t20101223_229313.html', date: '2010-12-23', type: 'park-published-historical-study', use: 'Historical textual descriptions of the arched gate, rear annex, raised platform and white-stone rails', limit: 'The parenthesis equating Qianlong 38 with 1774 is an error; 1773 is independently supported. Suggested new planting is not historic planting evidence.' },
  { id: 'park-wenshu-2016', title: '圆明园管理处、北京天心营国 · 圆明园正觉寺文殊菩萨造像研究报告', url: 'https://www.yuanmingyuanpark.cn/xs/yjbg/202007/P020200729554794277656.pdf', date: '2016-07', type: 'commissioned-iconography-study', use: 'PDF pp. 5–11: old gate photographs, published schematic plan, single-eave altered pavilion and repaired double-eave pavilion', limit: 'Uploaded in 2020. The colourful 盛时图 is a modern reconstruction illustration, not an identified Qing painting. Statue suggestions are not recovered dimensions.' },
  { id: 'cafa-wenshu-2020', title: '中央美术学院圆明园研究中心 · 圆明园正觉寺文殊像复原研究报告', url: 'https://www.yuanmingyuanpark.cn/xs/yjbg/202007/P020200729564817189269.pdf', date: '2020-01', type: 'commissioned-restoration-research', use: 'PDF pp. 15–18 historical chronology; p. 57 figure 41 modern pavilion section; p. 58 proposed statue; appendix pp. 162–168 ground-penetrating radar', limit: 'The 9.5 m statue is a restoration recommendation. The readable approximately 6.18/9.70 m section levels belong to the modern study, not a measured Qing original.' },
  { id: 'dpm-zhang-2021', title: '张孟增 · 圆明园正觉寺文殊造像历史演变考', url: 'https://img.dpm.org.cn/Uploads/File/2022/03/09/u6228283859ac9.pdf', date: '2021', type: 'palace-museum-journal-study', use: '故宫学刊2021, pp. 244, 249–250: losses after 1860, surviving trees and the actual damaged Zhengjuesi statue photograph', limit: 'The separate Chengde photographs are comparative examples, not photographs of the Yuanmingyuan statue.' },
  { id: 'beijing-restoration-2011', title: '北京市文物局 · 圆明园正觉寺复建工程进展顺利', url: 'https://wwj.beijing.gov.cn/bjww/362679/362680/482911/607095/index.html', date: '2011-02-11', type: 'heritage-authority-construction-record', use: '2004 approval, 2009 start, 2010 structural completion and 2011 finishing work', limit: '2659 square metres is the reported reconstruction scope, not a complete original site survey.' },
  { id: 'contractor-2012', title: '张峰亮 · 圆明园正觉寺复建工程的创优实践', url: 'https://www.bjgczl.com.cn/StaticPage/periolcontent_236.html', date: '2012-10-12', type: 'contractor-account-published-by-industry-association', use: 'Actual restored Sanshengdian photograph, surviving paintwork, seven-rafter-beam mock-up and Zuishanglou through-beam frame', limit: 'Modern Sanshengdian is double-eave xieshan; it must not replace the historical single-eave wudian in the study. Photos are private research references and are not bundled as textures.' },
];

const historical = ['qi-zhang-2021', 'park-zhengjuesi'];
const inferred = 'proportional interpretation; not an archaeological coordinate';
const hall = (id, name, center, width, depth, bays, depthBays, roof, extra = {}) => ({
  id: `zhengjuesi-${id}`, name, center, width, depth, bays, depthBays, roof,
  floor: .64, columnHeight: 4.45, roofRise: 3.0, sourceIds: historical,
  dimensionEvidence: inferred, roofEvidence: 'published historical form', ...extra,
});

export const zhengjuesiPlan = {
  id: 'zhengjuesi', name: '正觉寺', placementGroup: 'zhengjuesi',
  period: '1773–1860 historical architectural interpretation; later losses and 2002–2011 repair are separately documented',
  coordinates: '+X east, +Z south; independent local working metres',
  surveyed: false,
  boundary: { west: -32.5, east: 50.5, divisionX: 32.5, north: -74, south: 75, evidence: 'approximately 65 m main-court width from Qi/Zhang; remaining extent proportionally read from figure 3-1' },
  groundY: 0,
  axis: [
    hall('shanmen', '山门', [0, 75], 14.1, 4.3, 3, 1, 'xieshan', { floor: .48, columnHeight: 3.80, roofRise: 2.55, kind: 'arched-masonry-gate', passageWidth: 2.8, passageSpringY: 2.13, sourceIds: [...historical, 'wu-zhengjuesi', 'park-wenshu-2016'] }),
    hall('tianwangdian', '天王殿', [0, 39], 20.8, 10.2, 5, 3, 'xieshan', { columnHeight: 5.5, roofRise: 3.65, galleryDepth: 1.2 }),
    hall('sanshengdian', '正觉殿（三圣殿）', [0, 0], 30.8, 19.2, 7, 5, 'wudian', { floor: .96, columnHeight: 7.05, roofRise: 4.75, galleryDepth: 2.2, galleryEvidence: 'front and rear galleries reported in Wu/Jin Xun; the 2.2 m clear setback is proportional', rearAnnex: { width: 13.2, depth: 5, bays: 3, northEdge: -14.6, roofEvidence: 'rear three-bay annex supported; its joint and lower roof profile are inferred' }, modernRoof: 'double-eave-xieshan; deliberately not the historical study roof', sourceIds: [...historical, 'cafa-wenshu-2020', 'wu-zhengjuesi'] }),
    hall('wenshuting', '文殊亭', [0, -32.7], 10.4, 10.4, 8, null, 'double-octagonal-pyramid', { floor: .96, kind: 'octagonal-hall', wallApothem: 5.2, lowerEaveAboveFloor: 6.18, upperEaveAboveFloor: 9.70, columnHeight: 5.25, roofRise: 3.2, dougong: false, sourceIds: [...historical, 'cafa-wenshu-2020', 'park-wenshu-2016'], sectionEvidence: 'Modern figure 41 constrains readable beam levels; body widths and roof curves are proportional.' }),
    hall('zuishanglou', '最上楼', [0, -56.5], 30.1, 11.4, 7, 3, 'yingshan', { floor: .96, columnHeight: 3.82, upperHeight: 3.64, floorLevel: 4.10, storeys: 2, roofRise: 3.28, sourceIds: [...historical, 'contractor-2012'] }),
  ],
  wings: [-1, 1].flatMap(side => {
    const tag = side < 0 ? 'west' : 'east', label = side < 0 ? '西' : '东';
    return [
      hall(`${tag}-wufodian`, `${label}五佛殿`, [side * 27.3, 19.8], 16.3, 7.2, 5, 1, 'xieshan', { rotation: -side * Math.PI / 2 }),
      hall(`${tag}-peidian`, `${label}配殿`, [side * 27.3, -13.0], 16.3, 7.2, 5, 1, 'xieshan', { rotation: -side * Math.PI / 2 }),
      hall(`${tag}-jingangdian`, `${label}六大金刚殿`, [side * 27.3, -40.4], 16.3, 7.2, 5, 1, 'yingshan', { rotation: -side * Math.PI / 2, roofEvidence: 'rear side-hall position supported; hard-gable profile inferred from the published plan' }),
      hall(`${tag}-shunshan`, `${label}顺山转角房`, [side * 22.85, -56.5], 15.2, 8.6, 3, 1, 'yingshan', { columnHeight: 3.84, roofRise: 2.8, roofEvidence: 'three-bay flanking room supported; roof joint interpreted', sourceIds: ['park-zhengjuesi', 'qi-zhang-2021'] }),
    ];
  }),
  towers: [
    hall('gulou', '鼓楼', [-23.9, 62.2], 6.15, 6.15, 1, 1, 'xieshan', { floor: .58, columnHeight: 3.9, roofRise: 2.25, kind: 'drum', roofEvidence: 'paired tower position supported; single-eave roof proportions inferred' }),
    hall('zhonglou', '钟楼', [23.9, 62.2], 6.15, 6.15, 1, 1, 'xieshan', { floor: .58, columnHeight: 3.9, roofRise: 2.25, kind: 'bell', roofEvidence: 'paired tower position supported; single-eave roof proportions inferred' }),
  ],
  monkRooms: [
    [3, 42.2, 62], [3, 42.2, 39], [3, 42.2, 14], [3, 42.2, -11],
    [3, 42.2, -36], [3, 42.2, -61], [2, 37.9, 72], [2, 43.6, -70],
  ].map(([bays, x, z], i) => hall(`monks-${i + 1}`, `东跨院僧房 ${i + 1}`, [x, z], bays * 3.12, 5.2, bays, 1, 'yingshan', { floor: .24, columnHeight: 2.95, roofRise: 1.65, rotation: i < 6 ? -Math.PI / 2 : 0, kind: 'monk-room', roofEvidence: 'eight buildings / twenty-two rooms reported; block allocation and roof details are proportional', sourceIds: ['park-zhengjuesi'] })),
  courts: [
    { id: 'entrance-court', name: '山门前院', min: [-31.7, 44.7], max: [31.7, 74.5] },
    { id: 'front-court', name: '天王殿后院', min: [-31.7, 10.8], max: [31.7, 33.3] },
    { id: 'wenshu-court', name: '文殊亭院', min: [-31.7, -49.9], max: [31.7, -10.7] },
    { id: 'rear-court', name: '最上楼后院', min: [-31.7, -73.5], max: [31.7, -62.8] },
  ],
  raisedLinks: [
    { id: 'main-to-wenshu', width: 4.0, minZ: -27.5, maxZ: -14.6, y: .96 },
    { id: 'wenshu-to-rear', width: 4.0, minZ: -50.8, maxZ: -37.9, y: .96 },
  ],
  passageX: 20.0,
  treeEvidence: { reportedSurvivors: 26, recordedPeriod: '2001 return / early repair', sourceIds: ['dpm-zhang-2021', 'park-wenshu-2016'], surveyedPositions: null, modelPlacement: 'deferred; no invented point coordinates are labelled as ancient trees' },
  missingObjects: [
    { id: 'wenshu-statue', reason: 'A damaged original photograph and modern reconstruction studies are available, but the unseen geometry and exact polychromy have not been established for this architectural study.' },
    { id: 'four-script-gate-plaque', reason: 'The four scripts are documented; only the Chinese name is transcribed. Missing scripts and Qianlong calligraphy are not fabricated.' },
  ],
};

export function zhengjuesiBuildingFootprint(spec, margin = 0) {
  const hx = spec.width / 2 + margin, hz = spec.depth / 2 + margin;
  const c = Math.cos(spec.rotation ?? 0), s = Math.sin(spec.rotation ?? 0);
  return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => [spec.center[0] + x * c + z * s, spec.center[1] - x * s + z * c]);
}

export const allZhengjuesiBuildings = [...zhengjuesiPlan.axis, ...zhengjuesiPlan.wings, ...zhengjuesiPlan.towers, ...zhengjuesiPlan.monkRooms];
