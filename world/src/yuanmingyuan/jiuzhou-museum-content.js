import { supplementalImages } from './museum-image-supplement.js';

// Additive museum data; the integration owner merges it into the main reader.
// The model's visual acceptance and the evidence for a historical claim are
// separate records. No modern research illustration is publicly copied here.
const b = (zh, en) => ({ zh, en });

export const jiuzhouMuseumSources = {
  jiuzhouHeUpper: { title: b('贺艳 · 再现圆明园：九洲清晏（上）', 'He Yan · Reconstructing Yuanmingyuan: Jiuzhou Qingyan, part I'), url: 'https://www.dpm.org.cn/explode/others/209569.html', kind: b('故宫博物院刊载研究 · 时期变迁与原图影印', 'Palace Museum research · Chronology and reproduced historical drawings') },
  jiuzhouHeMiddle: { title: b('贺艳 · 再现圆明园：九洲清晏（中）', 'He Yan · Reconstructing Yuanmingyuan: Jiuzhou Qingyan, part II'), url: 'https://www.dpm.org.cn/explode/others/209592.html', kind: b('建筑研究 · 图档尺寸释读、现代平面与剖面', 'Architectural research · Archival dimensions, modern plans and sections') },
  jiuzhouHeLower: { title: b('贺艳 · 再现圆明园：九洲清晏（下）', 'He Yan · Reconstructing Yuanmingyuan: Jiuzhou Qingyan, part III'), url: 'https://www.dpm.org.cn/explode/others/209659.html', kind: b('建筑研究 · 戏台、如意桥与复原边界', 'Architectural research · Theatre, Ruyi Bridge and reconstruction limits') },
  jiuzhouNlc: { title: b('王丰会 · 从样式雷图档看圆明园“九州清晏”', 'Wang Fenghui · Jiuzhou Qingyan in the Yangshi Lei drawings'), url: 'https://www.nlc.cn/migrated/www.nlc.cn/newhxjy/wjsy/wjls/wjqcsy/wjd20q/d20qysltdjs/201011/P020101123720135260027.pdf', kind: b('中国国家图书馆 · 两页馆藏介绍', 'National Library of China · Two-page archival introduction') },
  jiuzhouShende: { title: b('李殊贤、张凤梧、梁雨 · 慎德堂研究', 'Li Shuxian, Zhang Fengwu and Liang Yu · Shendetang'), url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202601/t20260109_4800867.html', kind: b('园方刊载建筑史研究', 'Architectural history published by Yuanmingyuan Park') },
  jiuzhouPark: { title: b('圆明园管理处 · 九洲清晏', 'Yuanmingyuan Park · Jiuzhou Qingyan'), url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ymy/jzjq/201101/t20110104_231407.html', kind: b('机构景区说明 · 三路布局与桥梁', 'Institutional site description · Three routes and bridges') },
  jiuzhou1744Painting: { title: b('唐岱、沈源 · 1744 年九州清晏绢本', 'Tang Dai and Shen Yuan · Jiuzhou Qingyan, 1744'), url: supplementalImages.jiuzhouQingyan1744.source, kind: b('法国国家图书馆藏 · 早期四十景史画复制件', 'Bibliothèque nationale de France · Reproduction of the early Forty Scenes painting') },
};

// Reuse the already vendored and licensed bytes. This image is a comparison
// of the earlier garden, never an 1859 plan or a texture for the new buildings.
export const jiuzhouMuseumImages = {
  jiuzhouCore1744Comparison: {
    ...supplementalImages.jiuzhouQingyan1744,
    title: b('较早时期的九州清晏，1744', 'Jiuzhou Qingyan in an earlier period, 1744'),
    caption: b('唐岱、沈源绘；乾隆题诗、汪由敦书，法国国家图书馆藏。此图早于慎德堂、1837 年中路重建和后抱厦，供比较时期变化，不作为 1859—1860 年平面依据。', 'Painting by Tang Dai and Shen Yuan; Qianlong poem, Wang Youdun calligraphy; Bibliothèque nationale de France. It predates Shendetang, the 1837 central-axis rebuilding and the rear addition. It is shown to compare periods, not as the plan for 1859–1860.'),
    originalAuthors: ['唐岱 / Tang Dai', '沈源 / Shen Yuan'], originalDate: 1744,
    sha256: '35ecfd57ff3d29a7837dfb51e409df90c8eeb2b1abe87f5af36d4e5a98d7e1d6', bytes: 323403,
    provenanceFile: 'world/public/images/yuanmingyuan/provenance.json', generated: false, publicBundled: true,
    role: 'earlier-period-comparison-only', originalMeasurementDrawing: false,
  },
};

export const jiuzhouMuseumEntries = [
  {
    id: 'jiuzhou-qingyan-core', region: 'yuanmingyuan', kind: 'architecture', title: b('九洲清晏三路院落', 'The three routes of Jiuzhou Qingyan'),
    lead: b('临水的寝宫、家居与戏场，在一座岛上层层相接。', 'Residential halls, private courts and theatres shared a waterside island.'),
    sign: b('沿中路入殿，转入东西两侧的园居。', 'Follow the central halls, then turn into the western and eastern courts.'),
    paragraphs: [
      b('九洲清晏核心区的中路由圆明园殿、奉三无私和九洲清晏殿依次展开。西路包括慎德堂及基福堂、性存斋一带，东路为天地一家春等妃嫔院落。各路之间还有同道堂、戏台和较小的居住院落。', 'The central route linked Yuanmingyuan Hall, Fengsanwusi and Jiuzhou Qingyan Hall. Shendetang, Jifutang and Xingcunzhai occupied the west; Tiandiyijiachun and other consort residences lay to the east. Tongdaotang, a theatre and smaller courts stood between these routes.'),
      b('本次选取 1859—1860 年毁前的时间层。1836 年失火后，中路于 1837 年重建；九洲清晏殿在 1855 年添接三间后抱厦，中路两侧在 1857—1858 年改建游廊。1744 年史画与同治重修设计分别属于更早、更晚的时期。', 'This study selects the years 1859–1860, before destruction. The central route was rebuilt in 1837 after the 1836 fire. A three-bay rear hall was added in 1855, and side galleries followed in 1857–1858. The 1744 painting and the Tongzhi rebuilding proposals belong to earlier and later phases.'),
    ],
    sources: ['jiuzhouHeUpper', 'jiuzhouHeMiddle', 'jiuzhouNlc', 'jiuzhouPark'], images: ['jiuzhouCore1744Comparison'], related: ['jiuzhou', 'jiuzhou-qingyan-hall', 'jiuzhou-shendetang', 'jiuzhou-tiandi-courts'],
    note: b('建筑相对位置依据已发表的历史图档研究；岛岸和多数尺寸仍为比例配准，尚未恢复全部值房与室内陈设。', 'Relative positions follow published research on historical drawings. The shoreline and most dimensions remain proportional, and the full servants’ quarters and interior furnishings are not recovered.'),
  },
  {
    id: 'jiuzhou-qingyan-hall', region: 'yuanmingyuan', kind: 'architecture', title: b('九洲清晏殿与后抱厦', 'Jiuzhou Qingyan Hall and its rear addition'),
    lead: b('两段圆转屋面，共同承接于后金柱线。', 'Two rounded roofs meet at a shared inner purlin.'),
    sign: b('看连卷屋盖，也看前后不同的窗与彩画。', 'Look at the joined roofs, then compare the front and rear windows and paintwork.'),
    paragraphs: [
      b('研究释读五开间为十二、十二、十三、十二、十二尺；按文中营造尺换算，面阔为 19.52 米。正殿为八檩卷棚歇山，后抱厦为三间卷棚悬山，共用后金柱与金檩。本文采用的尺寸来自已发表的图档释读，不是本次现场实测。', 'Published readings give five bays of twelve, twelve, thirteen, twelve and twelve chi: 19.52 metres using the study’s chi conversion. The main hall has an eight-purlin rounded hip-and-gable roof; the three-bay rear addition shares its rear inner columns and purlin. These are published archival readings, not new site measurements.'),
      b('晚期前部使用朱红木构、龙凤和玺，后部使用绿油、斑竹和博古装饰。前檐四处窗的玻璃分格各不相同；西梢间北面的假支摘窗保留在实墙上。抱厦后金柱线上也是窗，不能把它改成贯通北门。', 'Late records distinguish vermilion timber and dragon-and-phoenix hexi in front from green, bamboo-pattern and antiquarian ornament at the back. The four front window positions have different glass subdivisions. The false window at the western rear remained on a solid wall, and the rear addition’s inner line carried windows rather than a through-door.'),
    ],
    sources: ['jiuzhouHeMiddle', 'jiuzhouHeUpper'], images: [], related: ['jiuzhou-qingyan-core', 'jiuzhou-tongdao-theatre'],
    note: b('曲面、瓦片、未给尺寸的木构和彩画细纹属于本次解释性设计；现代研究剖面没有被标成清代实测原图。', 'Curves, tiles, undocumented member sizes and fine paintwork are authored interpretations. Modern research sections are not labelled as Qing survey originals.'),
  },
  {
    id: 'jiuzhou-shendetang', region: 'yuanmingyuan', kind: 'architecture', title: b('慎德堂与西路园居', 'Shendetang and the western residences'),
    lead: b('五间三卷的寝殿，把起居与观戏纳入相连空间。', 'A five-bay, three-roof residence joined daily life and performance.'),
    sign: b('从三卷大殿，望向南侧各有形制的亭斋。', 'Look from the three-roof hall toward the distinct garden buildings to its south.'),
    paragraphs: [
      b('慎德堂于道光十年开工，次年落成，替代了更早的乐安和、怡情书史及附近鱼池一带。其南侧为昭吟镜、得心虚妙和峭碧，西侧另有基福堂、性存斋及穿堂、转角楼等院落。', 'Construction of Shendetang began in 1830 and finished the following year, replacing Leanhe, Yiqing Shushi and the neighbouring fish pond. Zhaoyinjing, Dexin Xumiao and Qiaobi lay to its south; Jifutang, Xingcunzhai, passage halls and a corner house formed separate western courts.'),
      b('1855—1856 年的改造把前进深处理为四间连通空间，西梢间承担演出，东部可设观戏座。舞台与观众空间合在室内，没有依据把整个前部另抬成一座固定高台。', 'Alterations in 1855–1856 opened four communicating bays in the front depth. Performance took place at the western end, with viewing space to the east. Stage and audience shared the interior; the evidence does not establish a separate raised platform across the entire front.'),
    ],
    sources: ['jiuzhouHeUpper', 'jiuzhouShende', 'jiuzhouHeLower'], images: ['jiuzhouCore1744Comparison'], related: ['jiuzhou-qingyan-core', 'jiuzhou-tongdao-theatre'],
    note: b('三卷、五间和院落相对关系有据，尚未读出本组全部尺寸与室内构件。西北转角楼的具体立面与楼梯为标明的推定。', 'The three roof volumes, five bays and relative court positions are documented. Complete dimensions and interior details remain unresolved; the corner house’s elevations and stairs are explicitly inferred.'),
  },
  {
    id: 'jiuzhou-tiandi-courts', region: 'yuanmingyuan', kind: 'architecture', title: b('天地一家春东路院落', 'The eastern courts of Tiandiyijiachun'),
    lead: b('宫门、正殿、配殿与十五间房，形成独立的家居进深。', 'A palace gate, main halls, side halls and fifteen rooms formed a separate residential sequence.'),
    sign: b('从宫门入院，沿两侧廊道向北行。', 'Enter through the palace gate and follow the side galleries north.'),
    paragraphs: [
      b('咸丰时期的东路以天地一家春宫门、前殿、后殿及泉石自娱十五间房为骨架，东西配殿围合前部院落。西邻原“东西六座”的中、东两院，其后层房在咸丰年间添接后卷并增加游廊。', 'In the Xianfeng period, the eastern route centred on the Tiandiyijiachun gate, front and rear halls, and the fifteen-room Quanshi Ziyu range. Side halls enclosed the front courts. The middle and eastern courts of the former “six buildings” lay to the west; their back halls gained additional roof volumes and galleries during this period.'),
      b('“天地一家春”之名也见于其他地点与后来的重修方案。因此，本组按已核对的本址时期平面安排，不能仅凭同名叙述复制另一座多卷大殿。', 'The name Tiandiyijiachun also appears at other sites and in later rebuilding proposals. This group follows the dated plan for this location; a similarly named multi-roof palace cannot be transferred here on the name alone.'),
    ],
    sources: ['jiuzhouHeUpper', 'jiuzhouHeMiddle', 'jiuzhouNlc'], images: [], related: ['jiuzhou-qingyan-core', 'jiuzhou-ruyi-bridge'],
    note: b('房间数量和组群关系有据；尚未取得全部实测尺寸、逐窗式样与原有居住陈设。', 'Room counts and group relationships are documented. Complete measured dimensions, every window pattern and the original domestic furnishings remain unresolved.'),
  },
  {
    id: 'jiuzhou-tongdao-theatre', region: 'yuanmingyuan', kind: 'architecture', title: b('同道堂戏台', 'The theatre at Tongdaotang'),
    lead: b('倒座戏台面向北，与观戏殿隔院相望。', 'The north-facing stage looked across a court toward the viewing hall.'),
    sign: b('站在院中，辨认台、殿与后台的关系。', 'From the court, trace the relationship between stage, viewing hall and backstage rooms.'),
    paragraphs: [
      b('晚期同道堂南院的前正房改为倒座戏台。图档释读下檐见方二十四尺，每面分五、十四、五尺三间，檐柱高十三尺、台高二尺一寸；其后与扮戏房相接。', 'The front building of Tongdaotang’s southern court became a north-facing stage. Published archival readings give a square lower tier of twenty-four chi, divided into bays of five, fourteen and five chi, with thirteen-chi posts and a platform 2.1 chi high. Backstage rooms stood behind it.'),
      b('重檐形制有据，上檐的屋架图表达则存在歧义。研究团队比较悬山与歇山后选用歇山，本模型保留这一解释，同时标明它不是无争议的原始测绘结论。没有添加未获证实的空中观戏连廊。', 'Double eaves are documented, but the upper roof framing is ambiguous. The researchers compared gable and hip-and-gable versions and selected the latter. This model retains that interpretation without presenting it as an unambiguous survey result, and adds no unsupported elevated viewing gallery.'),
    ],
    sources: ['jiuzhouHeLower', 'jiuzhouHeUpper'], images: [], related: ['jiuzhou-qingyan-core', 'jiuzhou-shendetang'],
    note: b('彩画、细木作、台阶轮廓和未标明尺寸的构件仍为推定。', 'Paintwork, fine joinery, stair outlines and undocumented member dimensions remain inferred.'),
  },
  {
    id: 'jiuzhou-ruyi-bridge', region: 'yuanmingyuan', kind: 'architecture', title: b('如意桥', 'Ruyi Bridge'),
    lead: b('如意石侧与可提起的木桥板，连接岛岸。', 'Carved stone sides and removable wooden planks linked the shores.'),
    sign: b('看木板下的承梁与栏杆中的透空枝叶。', 'Look beneath the planks at their bearings, and through the foliage of the railing.'),
    paragraphs: [
      b('如意桥位于九洲清晏东南。研究把样式雷图与遗存石件逐一对照，辨识出如意纹石侧、桥面石和支承木桥板的石梁。桥洞长十七尺，两侧桥基各长十二尺，不能用一条普通连续石拱概括其结构。', 'Ruyi Bridge stood at the southeast of Jiuzhou Qingyan. Comparison of Yangshi Lei drawings and surviving stones identifies ruyi-carved sides, deck stones and beams supporting the wooden planks. The opening measured seventeen chi and each abutment twelve chi; a generic continuous stone arch does not describe the full assembly.'),
      b('桥板通长十七尺，厚约三寸，配提环以便起卸。栏杆采用双面透雕木板，研究结合图档中的“番草五彩”等纹样讨论其装饰。当前刻叶与枝干是依据这类纹样重新设计，并非原件扫描。', 'The planks were seventeen chi long and about three cun thick, with lifting rings for removal. The railings used wood carved through on both faces; the research relates their ornament to archival descriptions of polychrome foreign foliage. The current leaves and stems are newly designed within that motif family, not scans of original pieces.'),
    ],
    sources: ['jiuzhouHeLower', 'jiuzhouPark'], images: [], related: ['jiuzhou-qingyan-core', 'jiuzhou-tiandi-courts', 'waterways'],
    note: b('桥宽、中间承梁排法与纹样细节仍为推定。其余四处岛岸桥路在本单体中仅保留带说明的接口。', 'Bridge width, intermediate beam placement and fine ornament remain inferred. The island’s other four bridge routes are represented only by labelled connection points in this study.'),
  },
];

export const jiuzhouMuseumSigns = Object.fromEntries(jiuzhouMuseumEntries.map(entry => [entry.id, { title: entry.title, text: entry.sign }]));
export { jiuzhouMuseumSources as sources, jiuzhouMuseumImages as images, jiuzhouMuseumEntries as entries };
