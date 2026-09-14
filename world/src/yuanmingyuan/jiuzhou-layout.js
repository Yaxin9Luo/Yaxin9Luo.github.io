// A late-Xianfeng study plan, not a survey or a Tongzhi rebuilding proposal.
// Pixel positions were read from Liu Chuan's 1860 reconstruction plan, published
// in He Yan, Jiuzhou Qingyan (middle), figure 10-7. Dimensioned historic data take
// priority where available. This pure module constructs no Three.js objects.
export const jiuzhouSources = {
  heUpper: { url: 'https://www.dpm.org.cn/explode/others/209569.html', author: '贺艳', title: '再现·圆明园——九洲清晏（上）', pages: '26–39', kind: 'institutional architectural study with historic drawing reproductions' },
  heMiddle: { url: 'https://www.dpm.org.cn/explode/others/209592.html', author: '贺艳', title: '再现·圆明园——九洲清晏（中）', pages: '32–43', kind: 'institutional reconstruction research; modern plans and models are labelled as such' },
  heLower: { url: 'https://www.dpm.org.cn/explode/others/209659.html', author: '贺艳', title: '再现·圆明园——九洲清晏（下）', pages: '36–49', kind: 'institutional research on stage, bridges and evidence limits' },
  nlcDrawings: { url: 'https://www.nlc.cn/migrated/www.nlc.cn/newhxjy/wjsy/wjls/wjqcsy/wjd20q/d20qysltdjs/201011/P020101123720135260027.pdf', author: '王丰会', title: '从样式雷图档看圆明园“九州清晏”', kind: 'museum archive catalogue; two-page introduction, not the seven original drawings' },
  shendetangStudy: { url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202601/t20260109_4800867.html', author: '李殊贤、张凤梧、梁雨', title: '慎德堂——走向成熟的多功能一体化建筑初探', kind: 'park architectural study; other similarly named palaces must be checked against the dated site plan' },
};

export const QING_CHI_METRES = .32;
const approximatePlanPoint = ([x, y]) => [(x - 425) * .32, (y - 300) * .32];
const hall = (id, name, route, pixel, width, depth, bays, roof, evidence = 'plan-relative proportions; exact dimensions unconfirmed') => ({ id, name, route, sourcePixel: pixel, center: approximatePlanPoint(pixel), width, depth, bays, roof, evidence });

export const jiuzhouPlan = {
  period: '1859–1860 before destruction; 1837 rebuilding, 1855 rear addition and 1857–1859 galleries retained',
  placementGroup: 'jiuzhou-qingyan', localFacing: '+Z south, +X east',
  coordinateEvidence: 'approximate registration of the reproduced 1860 research plan; no original surveyed coordinates recovered',
  sourcePlan: { sourceId: 'heMiddle', figure: '10-7', printedPage: 36, drawnBy: '刘川', type: 'modern research reconstruction', localImage: 'work/yuanmingyuan/references/jiuzhou/research-plan-1860.png', metresPerImagePixel: .32, approximate: true },
  originalPlanCheck: { sourceId: 'heUpper', figure: 14, printedPage: 38, original: '故宫博物院藏样1203 · 咸丰九年圆明园总平面图局部', inspected: true },
  reportedIslandExtent: { width: 234, depth: 116, approximate: true, sourceId: 'heUpper', notForcedOntoCurrentTerrain: true },
  measuredControls: {
    jiuzhouHall: {
      sourceId: 'heMiddle', printedPages: '38–40', evidence: 'published readings of dated Yangshi Lei drawings; separately identified archaeological column-base comparison',
      baysChi: [12, 12, 13, 12, 12], frontToRearInnerColumnsChi: 24, frontPorchChi: 6, rearPorchChi: 6,
      rearAdditionBaysChi: [12, 13, 12], rearAdditionDepthChi: 18, rearAdditionDepthIncludesOriginalPorchChi: 6, rearAdditionPorchChi: 6,
      eaveColumnHeightChi: 12, innerColumnHeightChi: 15, eaveColumnDiameterChi: 1.2, innerColumnDiameterChi: 1.3,
      platformHeightChi: 2.2, platformHeightAlternativeReadingsChi: [1.8, 2.2], platformProjectionChi: 3.2,
      roof: 'eight-purlin rounded xieshan main roof; rounded xuanshan rear addition joins at the rear inner-column line',
      roofJunction: {
        sourceFigure: 'He middle, fig11-2 (modern reconstruction section); checked against reproduced original fig12, Yangshi Lei 005-28-6',
        rejectedAlternatives: ['join at the rear eave', 'join inside the original porch'],
        sharedPurlinZChi: -12,
        mainEaveColumnZChi: [-18, 18], mainInnerColumnZChi: [-12, 12],
        rearAdditionInnerColumnsZChi: [-30, -12], rearAdditionRearEaveZChi: -36,
        mainRoofProjectionChi: 4,
        sectionMainPurlinZChi: [-18, -12, -6.6, -1.2, 1.2, 6.6, 12, 18],
        sectionRearSurvivingPurlinZChi: [-36, -30, -26.1, -22.2, -19.8, -15.9, -12],
        purlinSpacingEvidence: 'Derived from the authors’ 60/54/54/24 and 24/39/39/60 chains in modern fig11-2; these are not claimed as newly read original drawing figures.',
        mainCrownHeightChi: 27.6, rearCrownHeightChi: 25.5,
        crownHeightEvidence: 'Modern research section labels; skin, tile and rafter thickness still require an authored construction allowance.',
        mainRearWingClosure: 'Small bargeboard closure beside the xuanshan rear addition; fig13 and comparative construction photo fig14 explain this feature. It does not turn the whole main roof into xuanshan.',
      },
      excavatedColumnBaseMetres: [.76, .78, .38],
      colours: 'front vermilion timber and polychrome; rear green timber; bamboo-pattern green joinery in the late-Xianfeng study',
      lateJoinery: {
        sourceId: 'heMiddle', printedPages: '40–41', figure15Type: 'modern comparison drawing based on cited dated records',
        frontPlaneZChi: 12, rearAdditionPlaneZChi: -30,
        centralDoorLeaves: 4,
        frontWindowsWestToEast: [
          { bay: 'west-end', upperTransoms: 3, upperLeaves: 3, lowerGlassPanes: 2, lowerFrameWidthChi: 8.04, lowerFrameHeightChi: 4.76 },
          { bay: 'west-inner', lowerLeaves: 3, glassPanesPerLeaf: 1, paneSizeChi: [1.86, 2.85] },
          { bay: 'east-inner', upperTransoms: 3, centralGlassPanes: 1, paneSizeChi: [6.4, 6.4], frameSizeChi: [7.2, 7.2], removableVerticalKeepers: 2, removableUpperLeaves: 3, removableLowerLeaves: 3 },
          { bay: 'east-end', lowerLeaves: 3, glassPanesPerLeaf: 1, paneSizeChi: [1.86, 2.85] },
        ],
        rearWindows: [
          { bay: 'west-inner', upperTransoms: 0, upperLeaves: 3, lowerGlassPanes: 2, lowerFrameSizeChi: [9.25, 5.05], paneSizeChi: [4.35, 4.35] },
          { bay: 'east-inner', upperTransoms: 0, upperLeaves: 3, lowerGlassPanes: 2, paneSizeChi: [3.61, 4.2], removableVerticalKeepers: 2, removableLowerLeaves: 3 },
        ],
        westEndNorthWall: '1859 false zhizhai window mounted on the retained solid wall; it must not become a through-opening',
        frontPolychrome: { scheme: 'vermilion posts, dragon-and-phoenix hexi in blue, green, red, gold and ink', originalComparison: 'Yangshi Lei 014-4, reproduced fig16, records Yuanmingyuan Hall paintwork', role: 'the study authors infer this front-eave scheme from the related 1859 records; it is not an intact Jiuzhou painted beam' },
        rearPolychrome: { scheme: 'green posts, spotted-bamboo and bogu panels', originalComparisons: ['Yangshi Lei 060-67', 'Yangshi Lei 089-14'], limits: 'The cited keywords constrain the palette and motif families; exact panel composition is not recovered.' },
        allExternalJoinery: 'green spotted-bamboo finish, including the front windows',
        heavyBracketSetsDocumented: false,
        bracketEvidenceLimit: 'The inspected section shows eave beams, gujing blocks and purlins. No large multi-tier dougong specification has been recovered; absence of that specification is not proof that all brackets were absent.',
      },
    },
    tongdaoStage: { sourceId: 'heLower', printedPages: '41–43', footprintChi: [24, 24], faceBaysChi: [5, 14, 5], lowerColumnHeightChi: 13, platformHeightChi: 2.1, stageFaces: 'north', roof: 'double-eave form documented; xieshan upper roof remains the research authors’ argued interpretation', aerialGalleryDocumented: false },
    ruyiBridge: { sourceId: 'heLower', printedPages: '43–48', clearSpanChi: 17, abutmentLengthChi: 12, deck: 'removable long wooden planks on stone beams', balustrade: 'double-sided open-carved wooden foliage panels', support: 'one opening, carved ruyi stone sides; not a generic arch bridge' },
  },
  core: [
    hall('jiuzhou-yuanmingyuan-hall', '圆明园殿', 'central', [425, 400], 19.52, 10.88, 5, 'juanpeng-xieshan'),
    hall('jiuzhou-fengsanwusi', '奉三无私', 'central', [425, 265], 25.92, 11.52, 7, 'juanpeng-xieshan', 'seven bays and reduced end bays supported; exact front-hall subdivisions remain inferred'),
    hall('jiuzhou-qingyan-hall', '九洲清晏殿', 'central', [425, 177], 19.52, 11.52, 5, 'juanpeng-xieshan-with-rear-xuanshan', 'measuredControls.jiuzhouHall; the three-bay rear addition is separate from the main depth'),
    hall('jiuzhou-tongdaotang', '同道堂', 'central-west', [354, 168], 11.84, 7.68, 3, 'juanpeng-xuanshan'),
    hall('jiuzhou-qinghuitang', '清晖堂', 'central-east', [486, 169], 11.84, 7.68, 3, 'juanpeng-xuanshan', '1859 northern addition, not the demolished western Qinghuige'),
    hall('jiuzhou-tongdao-stage', '同道堂戏台', 'central-west', [359, 220], 7.68, 7.68, 3, 'double-xieshan', 'measuredControls.tongdaoStage; actual late design has double eaves'),
    hall('jiuzhou-tongdao-dressing', '同道堂扮戏房', 'central-west', [359, 252], 10.24, 9.60, 3, 'two-juanpeng-xuanshan', 'two linked roof volumes; exact dimensions and upper-stage roof interpretation remain separate'),
    hall('jiuzhou-shendetang', '慎德堂', 'west', [288, 222], 24.0, 26.4, 5, 'three-juanpeng', 'five-bay three-roof hall documented; working width and exterior proportions inferred'),
    hall('jiuzhou-jifutang', '基福堂', 'far-west', [202, 234], 13.44, 7.68, 3, 'juanpeng-xieshan'),
    hall('jiuzhou-xingcunzai', '性存斋', 'far-west', [202, 192], 13.44, 7.68, 3, 'juanpeng-xieshan'),
    hall('jiuzhou-west-chuantang', '西路穿堂', 'far-west', [202, 312], 13.44, 5.76, 3, 'juanpeng-xuanshan'),
    hall('jiuzhou-west-corner-house', '西北转角楼', 'far-west', [156, 210], 7.68, 13.44, 4, 'l-shaped-juanpeng', 'corner building supported; storey heights and roof intersection require separate fixtures'),
    hall('jiuzhou-dexinxumiao', '得心虚妙', 'west-garden', [288, 326], 11.84, 5.12, 3, 'juanpeng-xuanshan', 'south-facing side of the courtyard is occupied by north-facing garden halls, not identical open gazebos'),
    hall('jiuzhou-zhaoyinjing', '昭吟镜', 'west-garden', [322, 321], 5.12, 5.12, 1, 'xieshan'),
    hall('jiuzhou-qiaobi', '峭碧', 'west-garden', [254, 321], 5.12, 5.12, 1, 'xieshan'),
    hall('jiuzhou-tiandiyijiachun', '天地一家春', 'east', [605, 288], 23.04, 9.60, 5, 'juanpeng-xieshan', 'front hall in the dated Jiuzhou plan; do not transfer the similarly named Tongzhi or Qichunyuan multi-roof proposals'),
    hall('jiuzhou-tiandi-rear-hall', '天地一家春后殿', 'east', [605, 226], 23.04, 8.64, 5, 'juanpeng-xieshan'),
    hall('jiuzhou-quanshiziyu', '泉石自娱十五间房', 'east', [605, 194], 40.32, 4.80, 15, 'juanpeng-xuanshan'),
    hall('jiuzhou-tiandi-palace-gate', '天地一家春宫门', 'east', [605, 347], 13.44, 5.76, 3, 'juanpeng-xuanshan'),
    hall('jiuzhou-tiandi-west-wing', '天地一家春西配殿', 'east', [550, 291], 16.64, 5.12, 5, 'juanpeng-xuanshan'),
    hall('jiuzhou-tiandi-east-wing', '天地一家春东配殿', 'east', [663, 291], 16.64, 5.12, 5, 'juanpeng-xuanshan'),
    hall('jiuzhou-middle-east-front', '东西六座中院前殿', 'inner-east', [491, 290], 11.52, 6.4, 3, 'juanpeng-xuanshan'),
    hall('jiuzhou-middle-east-rear', '东西六座中院后殿', 'inner-east', [491, 216], 11.52, 10.24, 3, 'two-juanpeng-xuanshan'),
    hall('jiuzhou-east-court-front', '东西六座东院前殿', 'inner-east', [528, 290], 9.60, 6.4, 3, 'juanpeng-xuanshan'),
    hall('jiuzhou-east-court-rear', '东西六座东院后殿', 'inner-east', [528, 216], 9.60, 10.24, 3, 'two-juanpeng-xuanshan'),
  ],
  constructionNext: [
    'Check the built, proportionally registered courts and galleries against newly recovered original dimensions when available.',
    'Replace the labelled proportional island trace when a calibrated survey is available; align the existing generalized garden-layout island separately.',
    'Complete the composed CPU and native review of the built shared-purlin roof, pierced windows, gallery junctions and enclosed side suites.',
    'Keep unmeasured suite-door positions, platform-gallery roof sections and servant-room subdivisions explicitly inferred.',
  ],
  excludedPhases: ['pre-1831 western Qinghuige/Leanhe ensemble', '1873–1874 two-roof Jiuzhou hall / four-roof Shendetang proposals', '1896 eastern-court proposals', '1929 memorial'],
  deferred: ['Zhengda Guangming and the southern court group', 'complete original interior contents and all servants’ quarters', 'lake-bed terrain and live vegetation'],
  validationBoundary: 'This pure research plan is not a production or visual acceptance record. Actual runs and source hashes are recorded separately.',
};
