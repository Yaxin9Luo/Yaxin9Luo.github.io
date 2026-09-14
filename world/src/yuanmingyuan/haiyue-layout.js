// Local working metres, north = -Z. This late-period reconstruction is kept
// separate from the much more ornamented Qianlong arrangement.
export const haiyueSources = {
  research: {
    title: '林芷伊 · 圆明园新识——海岳开襟复原初探',
    url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202406/t20240627_4658366.html',
    date: '2024-06-27',
    kind: 'institution-published-reconstruction-research',
    inspected: ['period tables 1–2', 'figures 8–10', 'figure 12', 'figure 14', 'figure 15'],
    limits: 'Small reproductions and a modern reconstruction, not a registered high-resolution original. Figure 12 is Chen Yuan’s proposed Xianfeng-period reconstruction.',
  },
  site: {
    title: '圆明园管理处 · 海岳开襟',
    url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231497.html',
    kind: 'institutional-site-description',
  },
};

export const haiyuePeriod = {
  target: '1859–1860 study',
  qianlong: { mainBaosha: 4, cornerPavilions: 4, curvedGalleries: 4, paifang: 4, sideHalls: 0, northSouthBays: 3 },
  xianfeng: { mainBaosha: 0, cornerPavilions: 0, curvedGalleries: 0, paifang: 0, sideHalls: 2, northSouthBays: 5 },
  evidence: 'Lin 2024 tables 1–2; the date and exact extent of intervening alterations are not established.',
  excludedLaterFeature: 'The western timber bridge belongs to the Guangxu period and is not part of this 1859–1860 scene.',
};

export const haiyueLayout = {
  id: 'haiyue-kaijin-late-period-study',
  gardenGroup: 'haiyue-kaijin',
  metricAccuracy: 'not-established',
  datum: 'Upper and lower terrace heights are authored exhibition dimensions.',
  coordinateSystem: '+X east, +Y up, -Z north; local +Z is the outward dock direction.',
  waterline: -.65,
  groundY: -2.3,
  terraces: [
    { id: 'lower', radius: 39, topY: .4, bottomY: -2.3, evidence: 'Approximate 78 m diameter discussed in Lin 2024; not independently surveyed.' },
    { id: 'upper', radius: 31.3, topY: 2.2, bottomY: .4, evidence: 'Reported 62.6 m upper circle, Lin 2024 section 4.2.1; height inferred.' },
  ],
  docks: [
    { id: 'west', rotationY: -Math.PI / 2 },
    { id: 'north', rotationY: Math.PI },
    { id: 'east', rotationY: Math.PI / 2 },
    { id: 'south', rotationY: 0 },
  ],
  dock: { width: 5.0, landingDepth: 1.8, landingY: -.48, stairs: 6, pitch: .32, evidence: 'Four cardinal docks are documented; working dimensions and waterline are authored.' },
  terraceStair: { width: 4.2, count: 12, pitch: .32, evidence: 'Four axial routes between the two circular terraces; individual stair construction and levels are interpreted.' },
  main: {
    id: 'haiyue-main-pavilion', center: [0, 0], floorY: 2.6,
    levels: [
      { width: 15.4, roomWidth: 11.4, bays: [2, 3.8, 3.8, 3.8, 2], floorY: 2.6, columnHeight: 4.3 },
      { width: 11.5, roomWidth: 8.5, bays: [11.5 / 3, 11.5 / 3, 11.5 / 3], floorY: 9.35, columnHeight: 3.3 },
      { width: 8.5, roomWidth: 8.5, bays: [2.333, 3.834, 2.333], floorY: 14.8, columnHeight: 2.7 },
    ],
    roof: 'three eaves, cross-ridged top, no four attached baosha in the late arrangement',
    dimensionsEvidence: 'Ground widths follow the reported approximately 15.5 m and 3.8/2 m bays; upper levels are proportional readings of modern figure 12, with all heights inferred.',
    stairwell: { minX: -3.95, maxX: -1.05, minZ: -2.8, maxZ: 2.9, entryZ: 3.20, run: 4.86, flightWidth: 1.16, flightCounts: [18, 15], evidence: 'West internal stair appears in modern figure 12; exact turn, treads, structural clearances and landing positions are authored.' },
  },
  halls: [
    { id: 'linyuan-jinjing', title: '林渊锦镜', center: [0, 21], width: 19, depth: 7.6, bays: 5, floorY: 2.56, columnHeight: 4.3, galleryDepth: 1.45, rotationY: 0, baosha: { width: 11.4, bays: 3, depth: 3.8, direction: 'south', evidence: 'Figure 14 shows the projection toward plan south. Pairing the two halls by a half turn is an exhibition interpretation; original-plan identity is not legible.' } },
    { id: 'xiuyi-cenqing', title: '秀挹岑清', center: [0, -21], width: 19, depth: 7.6, bays: 5, floorY: 2.56, columnHeight: 4.3, galleryDepth: 1.45, rotationY: Math.PI, baosha: { width: 11.4, bays: 3, depth: 3.8, direction: 'north', evidence: 'Mirrored pairing of the south-oriented modern figure 14; not a surveyed orientation.' } },
    { id: 'west-hall', title: '西配殿', center: [-23, 0], width: 11.4, depth: 6.4, bays: 3, floorY: 2.56, columnHeight: 3.9, galleryDepth: 1.20, rotationY: Math.PI / 2 },
    { id: 'east-hall', title: '东配殿', center: [23, 0], width: 11.4, depth: 6.4, bays: 3, floorY: 2.56, columnHeight: 3.9, galleryDepth: 1.20, rotationY: -Math.PI / 2 },
  ],
  hallEvidence: 'Late hall counts follow period table and plan. Centres, heights and bay spans are authored proportionally. The E/W double-eave roof is the researcher’s hypothesis, not an archival roof specification.',
};

export const haiyueMaterialEvidence = {
  stone: 'White stone revetment and white marble rails are described. Courses, relief and finish are authored, informed by the article’s Tiantan comparison.',
  roof: 'Yellow glazed tiles with green margins follow Lin 2024’s comparative reconstruction using Dafodian. The site’s original glaze colours have not been sampled or independently verified.',
  paint: 'Blue-green framing, vermilion timber and light gilded ornament are a restrained original interpretation; no exact Haiyue polychromy pattern survives in the sources inspected.',
  vegetation: 'The account mentions 24 lacebark pines and potted trees in the earlier ensemble. No exact late-period positions, species-specific approved asset or tree distribution is inferred here.',
};
