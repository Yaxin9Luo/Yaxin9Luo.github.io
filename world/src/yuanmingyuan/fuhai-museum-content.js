// Additive catalogue data. The main museum catalogue decides when to merge it.
// Research images are not public assets until their bytes and provenance have
// actually been vendored. Never label a generated reference as a historic view.
const b = (zh, en) => ({ zh, en });

export const fuhaiSources = {
  fanghuPark: { title: b('圆明园管理处 · 方壶胜境', 'Yuanmingyuan Park · Fanghu Shengjing'), url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ymy/fhjq/201101/t20110105_231470.html', kind: b('机构景点说明', 'Institutional site description') },
  pengdaoPark: { title: b('圆明园管理处 · 蓬岛瑶台', 'Yuanmingyuan Park · Pengdao Yaotai'), url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ymy/fhjq/201101/t20110105_231469.html', kind: b('机构景点说明', 'Institutional site description') },
  fanghuBnf1744: { title: b('法国国家图书馆 · 方壺勝境，1744', 'Bibliothèque nationale de France · Fanghu Shengjing, 1744'), url: 'https://catalogue.bnf.fr/ark:/12148/cb43818430f', kind: b('四十景绢本 · 第 29 景 · RESERVE B-9-FT6', 'Silk painting · Scene 29 · RESERVE B-9-FT6') },
  pengdaoBnf1744: { title: b('法国国家图书馆 · 蓬島瑤臺，1744', 'Bibliothèque nationale de France · Pengdao Yaotai, 1744'), url: 'https://catalogue.bnf.fr/ark:/12148/cb43818854j', kind: b('四十景绢本 · 第 32 景 · RESERVE B-9-FT6', 'Silk painting · Scene 32 · RESERVE B-9-FT6') },
  fortyScenesGuo: { title: b('郭黛姮 ·《圆明园四十景》图的价值', 'Guo Daiheng · The value of the Forty Scenes of Yuanmingyuan'), url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj035/201611/t20161113_1317935.html', kind: b('具名建筑史研究', 'Authored architectural research') },
  pengdaoTheatre: { title: b('圆明园戏场探微 · 蓬岛瑶台', 'Theatres of Yuanmingyuan · Pengdao Yaotai'), url: 'https://www.yuanmingyuanpark.cn/xs/yjbg/202108/t20210831_4483509.html', kind: b('园方研究 · 两卷七间殿与五间抱厦', 'Park research · Seven-bay hall and five-bay projecting hall') },
  fuhaiWater: { title: b('朱红、梁越 · 圆明园水资源综合可持续利用研究', 'Zhu Hong and Liang Yue · Yuanmingyuan water resources'), url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202005/t20200506_4402578.html', kind: b('园方刊载研究 · 历史水系与用途', 'Park research · Historic waterways and their uses') },
  fuhaiDragonBoats: { title: b('圆明园管理处 · 端午节龙舟竞渡', 'Yuanmingyuan Park · Dragon-boat racing at the Duanwu festival'), url: 'https://www.yuanmingyuanpark.cn/ts/tgs/202608/t20260803_4824124.html', kind: b('机构解说 · 引《钦定日下旧闻考》卷八十二', 'Institutional interpretation · Citing Rixia Jiuwen Kao, chapter 82') },
  fanghuBronzeDrawings: { title: b('国家图书馆 · 方壶铜龙、铜凤样式雷立样', 'National Library of China · Yangshi Lei dragon and phoenix drawings for Fanghu'), url: 'https://www.nlc.cn/nmcb/gcjpdz/ysl/zxcs/', kind: b('清代设计原图 · 具体摆放位置未定', 'Qing design drawings · Exact placement unresolved') },
};

// Safe to spread into museumImages now. This stays empty until the integration
// owner copies reviewed files into public/ and appends the public provenance log.
export const fuhaiImages = {};

export const fuhaiImageCandidates = {
  fanghu1744: {
    kind: 'historic-painting', title: b('方壺勝境 · 1744 年四十景绢本', 'Fanghu Shengjing · Forty Scenes, 1744'),
    caption: b('唐岱、沈源合绘，法国国家图书馆藏。图中可见湖上三亭、石台与层叠楼阁。画面距离不等于实测尺寸。', 'Painted by Tang Dai and Shen Yuan; collection of the Bibliothèque nationale de France. Three waterside pavilions, stone terraces and layered halls appear in the view. Pictorial distances are not survey measurements.'),
    credit: b('法国国家图书馆藏 · Wikimedia Commons 历史画面复制件', 'Collection of the Bibliothèque nationale de France · Historic painting reproduction via Wikimedia Commons'),
    originalAuthors: ['唐岱 / Tang Dai', '沈源 / Shen Yuan'], originalDate: 1744,
    albumText: b('乾隆题诗，汪由敦书写；本文件为绘画页', 'Poetry by the Qianlong emperor, calligraphy by Wang Youdun; this file is the painting leaf'),
    catalogue: 'https://catalogue.bnf.fr/ark:/12148/cb43818430f', source: 'https://commons.wikimedia.org/wiki/File:Beautiful_Scene_of_the_Square_Pot.jpg',
    originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Beautiful_Scene_of_the_Square_Pot.jpg',
    localResearchFile: 'work/yuanmingyuan/references/fuhai/fanghu-commons.jpg', proposedPublicSrc: '/images/yuanmingyuan/fanghu-1744.jpg',
    width: 1680, height: 1688, bytes: 2965015, sha256: '4011bdc1693ba3d70a80f32d1644f7af793d4cf6025294a4a4245c4f896dd1f3',
    license: 'PD-Art (PD-old-100-expired); Public Domain Mark 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    licenseEvidenceFile: 'work/yuanmingyuan/references/fuhai/fanghu-commons-rights.html',
    rightsReviewedAt: '2026-09-12', visuallyVerified: true, generated: false, publicBundled: false, status: 'reviewed-candidate-awaiting-vendoring',
    dateNote: b('Commons 的 2011/2019 时间属于复制文件；原作年代按 BnF 目录记为 1744。', 'The Commons dates of 2011/2019 concern the reproduction file. The original date is 1744 in the BnF catalogue.'),
  },
  pengdao1744: {
    kind: 'historic-painting', title: b('蓬島瑤臺 · 1744 年四十景绢本', 'Pengdao Yaotai · Forty Scenes, 1744'),
    caption: b('唐岱、沈源合绘，法国国家图书馆藏。主岛院落与两侧小岛显示出不同尺度，南侧码头面向湖水。', 'Painted by Tang Dai and Shen Yuan; collection of the Bibliothèque nationale de France. The main courtyard and smaller flanking islands have distinct scales, with a landing facing the lake to the south.'),
    credit: b('法国国家图书馆藏 · MIT Visualizing Cultures 研究复制件', 'Collection of the Bibliothèque nationale de France · Research reproduction from MIT Visualizing Cultures'),
    originalAuthors: ['唐岱 / Tang Dai', '沈源 / Shen Yuan'], originalDate: 1744,
    albumText: b('乾隆题诗，汪由敦书写；本文件为绘画页', 'Poetry by the Qianlong emperor, calligraphy by Wang Youdun; this file is the painting leaf'),
    catalogue: 'https://catalogue.bnf.fr/ark:/12148/cb43818854j', source: 'https://visualizingcultures.mit.edu/garden_perfect_brightness/ymy1_essay03.html',
    originalUrl: 'https://visualizingcultures.mit.edu/garden_perfect_brightness/image/ymy1032_72_Pengdao17135.jpg',
    localResearchFile: 'work/yuanmingyuan/references/fuhai/pengdao-mit.jpg', width: 622, height: 623, bytes: 481697,
    sha256: '996b5462600ea12da0a0a820497ec175447e4ff5e7b60d50e38f429aad378896',
    license: null, visuallyVerified: true, generated: false, publicBundled: false, status: 'research-only-reproduction-rights-unresolved',
    rightsNote: b('MIT 页为 CC BY-NC-SA 站点说明；另一份 Commons 文件标 CC BY-SA 3.0。没有把这些不同文件的许可改写成 Public Domain Mark。', 'MIT carries a site-level CC BY-NC-SA notice, while a different Commons file is labelled CC BY-SA 3.0. Neither notice is rewritten as a Public Domain Mark for these downloaded bytes.'),
    alternateRightsPage: 'https://commons.wikimedia.org/wiki/File:Jade_Terrace_of_Paradise_Island.jpg', licenseEvidenceFile: 'work/yuanmingyuan/references/fuhai/pengdao-commons-rights.html',
  },
};

export const fuhaiEntries = [
  {
    id: 'fanghu-shengjing', region: 'yuanmingyuan', kind: 'architecture', title: b('方壶胜境', 'Fanghu Shengjing'),
    lead: b('黄瓦重楼与白石高台，在湖岸层层展开。', 'Yellow-glazed roofs rise above white stone terraces by the lake.'),
    sign: b('循着白石台阶，望向三亭与层叠楼阁。', 'Follow the stone steps toward three pavilions and layered halls.'),
    paragraphs: [
      b('方壶胜境位于福海东北湾的北岸。三座重檐大亭向湖中伸出，白石台基合成“山”字形；中后部的九座楼阁构成宗教性建筑群。', 'Fanghu Shengjing stood on the northern shore of Fuhai’s northeastern bay. Three double-eave pavilions projected over the lake on white stone bases arranged like the character 山, “mountain.” Nine halls farther back formed a religious ensemble.'),
      b('唐岱、沈源绘于 1744 年的四十景绢本，保存了临水高台、朱红木构与青绿装饰的面貌。国图另藏方壶铜龙、铜凤样式雷立样；原图所示基座与它们在建筑中的摆放位置，需要分别研究。', 'The 1744 Forty Scenes painting by Tang Dai and Shen Yuan records waterside terraces, red timber and blue-green ornament. The National Library of China also holds Yangshi Lei drawings of a dragon and phoenix for Fanghu; their illustrated pedestals do not by themselves establish where the objects stood.'),
    ],
    sources: ['fanghuPark', 'fanghuBnf1744', 'fortyScenesGuo', 'fanghuBronzeDrawings'], related: ['fuhai', 'pengdao-yaotai'], images: [],
    note: b('当前模型为比例研究。1744 年史画早于本展览的 1859—1860 年时间层，尺寸和后期细节仍待核对。', 'The model is a proportional study. The 1744 view predates the exhibition’s 1859–1860 time frame; dimensions and later details remain under review.'),
  },
  {
    id: 'pengdao-yaotai', region: 'yuanmingyuan', kind: 'architecture', title: b('蓬岛瑶台', 'Pengdao Yaotai'),
    lead: b('三岛相望，桥与舟连接水上园居。', 'Bridges and boats connected garden life across three islands.'),
    sign: b('从南侧登岸，穿过镜中阁，回望湖中的三岛。', 'Land from the south, pass through Jingzhongge and look back across the islands.'),
    paragraphs: [
      b('蓬岛瑶台以福海中央的大小三岛寄托仙山意境。主岛容纳院落与殿宇，两座较小岛屿通过桥梁相接；石岸、码头和廊亭共同组织游赏。', 'Three islands near the centre of Fuhai evoked the mountains of immortals. The main island held halls and courts, with bridges to two smaller islands. Stone shores, landings and galleries shaped the visitor’s route.'),
      b('南门镜中阁为三开间，中央屋顶上另有一间歇山阁楼。郭黛姮对史画的研究辨识出阁楼每面四攒斗拱、青绿梁枋和红色十字窗格。主殿则记为两卷七间，前接五间抱厦。', 'The three-bay southern gate, Jingzhongge, carried a one-bay loft with a hip-and-gable roof. Guo Daiheng’s study identifies four bracket groups on each loft face, blue-green beams and red cross-pattern window bars. The main hall is described as seven bays under two joined roof volumes, with a five-bay hall projecting in front.'),
    ],
    sources: ['pengdaoPark', 'pengdaoBnf1744', 'fortyScenesGuo', 'pengdaoTheatre', 'fuhaiDragonBoats'], related: ['fuhai', 'fanghu-shengjing'], images: [],
    note: b('三岛轮廓与桥的位置仍为比例示意。文献中的方位、画面透视和今日遗址需要进一步配准。', 'Island outlines and bridge positions remain proportional. Directions in the texts, pictorial perspective and surviving remains still require alignment.'),
  },
  {
    id: 'fuhai', region: 'yuanmingyuan', kind: 'landscape', title: b('福海', 'Fuhai'),
    lead: b('湖水既组织景色，也承载舟行与节令活动。', 'The lake shaped views, boat journeys and seasonal celebrations.'),
    sign: b('沿湖望亭台，渡水见三岛。', 'Follow the lakeside views and cross the water to three islands.'),
    paragraphs: [
      b('方壶胜境面向福海东北湾，蓬岛瑶台居于湖中。岸与岛之间的空阔水面，让殿阁可以从不同距离和方向进入视野。', 'Fanghu Shengjing faced the northeastern bay, while Pengdao Yaotai occupied islands within the lake. Open water between shores and islands offered changing distances and directions from which to see the architecture.'),
      b('园方水资源研究记述，福海的水深与行大船、端午龙舟竞渡有关。圆明园水系还承担交通和物资运输，各处湖底、岸线与水深因用途而异。', 'The park’s water study relates Fuhai’s depth to large boats and dragon-boat racing at Duanwu. Waterways also carried people and supplies, with lake beds, banks and depths adapted to different uses.'),
    ],
    sources: ['fuhaiWater', 'fuhaiDragonBoats', 'fanghuPark', 'pengdaoPark'], related: ['fanghu-shengjing', 'pengdao-yaotai', 'waterways'], images: [],
    note: b('展览中的海上外环境属于当代展示设计；历史上的福海是北京圆明园内的湖泊。', 'The exhibition’s offshore setting is a contemporary display device. The historical Fuhai was a lake within the gardens in Beijing.'),
  },
];

export const fuhaiSigns = Object.fromEntries(fuhaiEntries.map(entry => [entry.id, { title: entry.title, text: entry.sign }]));
export { fuhaiSources as sources, fuhaiImages as images, fuhaiEntries as entries };
