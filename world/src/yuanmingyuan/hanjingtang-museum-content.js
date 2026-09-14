// Pure catalogue data: importing this file constructs no geometry or textures.
// The integration owner merges these entries into the main museum catalogue.
const b = (zh, en) => ({ zh, en });
const catalogue = 'https://digitalarchive.npm.gov.tw/Collection/Detail/2106?dep=P';
const publicRoot = '/art/references/hanjingtang/';

export const hanjingtangSources = {
  hanjingWang2015: {
    title: b('王文涛 · 紫禁城宁寿宫区与长春园含经堂区建筑关系探讨', 'Wang Wentao · The relationship between Ningshougong and Hanjingtang in Changchunyuan'),
    url: 'https://www.dpm.org.cn/Uploads/File/2020/03/27/u5e7db6f5d6c90.pdf',
    kind: b('故宫学刊，2015 · 建筑史研究及清代图档影印', 'Studies of the Palace Museum, 2015 · Architectural research and reproductions of Qing drawings'),
    pages: '359–364',
    figures: [
      { number: 5, page: 359, title: b('长春园淳化轩 · 乾隆时期图档', 'Chunhuaxuan in Changchunyuan · Qianlong-period drawing'), originalRepository: b('中国国家图书馆', 'National Library of China'), originalMaker: b('样式雷绘图机构', 'Yangshi Lei architectural office') },
      { number: 6, page: 359, title: b('长春园淳化轩贴改图 · 嘉庆时期图档', 'Revised drawing of Chunhuaxuan · Jiaqing-period drawing'), originalRepository: b('中国国家图书馆', 'National Library of China'), originalMaker: b('样式雷绘图机构', 'Yangshi Lei architectural office') },
      { number: 9, page: 361, title: b('淳化轩平面图 · 乾隆时期图档', 'Plan of Chunhuaxuan · Qianlong-period drawing'), originalRepository: b('中国国家图书馆', 'National Library of China'), originalMaker: b('样式雷绘图机构', 'Yangshi Lei architectural office') },
    ],
    imageUse: b('实际核对论文中的图版；未取得可公开打包的原图许可。小幅影印上的尺寸数字不足以据此测绘。', 'The reproduced figures were inspected. Permission to distribute the original drawings has not been established, and their small dimension figures cannot support a measured reconstruction.'),
    publicImagesBundled: false,
  },
  hanjingSunSite: {
    title: b('孙晨露 · 含经堂遗址的展览展示', 'Sun Chenlu · Interpreting the Hanjingtang ruins'),
    url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj020/201012/t20101226_229503.html',
    kind: b('圆明园管理处刊载 · 遗址与展示研究', 'Published by Yuanmingyuan Park · Site and interpretation study'),
  },
  hanjingNpmChunhua: {
    title: b('国立故宫博物院 · 御製重刻淳化閣帖（一） 冊', 'National Palace Museum · Imperial Recarving of the Chunhua Pavilion Modelbooks, volume one'),
    url: catalogue,
    kind: b('馆藏法帖 · 故帖000204N000000000', 'Museum modelbook album · 故帖000204N000000000'),
    manifest: 'https://digitalarchive.npm.gov.tw/Integrate/GetJson?cid=2106&dept=P',
    textCredit: '御製重刻淳化閣帖（一） 冊。國立故宮博物院，臺北，CC BY 4.0 @ www.npm.gov.tw',
  },
  hanjingDpmSanyou: {
    title: b('故宫博物院 · 宁寿宫花园三友轩', 'The Palace Museum · Sanyouxuan in the Ningshougong Garden'),
    url: 'https://www.dpm.org.cn/explore/building/236474.html',
    kind: b('现存乾隆时期建筑 · 仅作比较', 'Surviving Qianlong-period building · Comparative evidence only'),
    limit: b('这是 1774 年建成的宫内三友轩；其不对称屋顶、尺寸和全部装修不能直接作为圆明园三友轩的原样。', 'This is the palace Sanyouxuan, completed in 1774. Its asymmetric roof, dimensions and complete interior cannot be treated as the original form of the Yuanmingyuan building.'),
  },
};

// Unaltered museum JPEGs already vendored with a separate provenance JSON each.
// A full image view must show these complete frames, not the model's UV crops.
const rubbingRecords = [
  { suffix: 'PAI', opening: 8, bytes: 88394, sha256: 'e00697ebf238a705e06d249875a160ee62ea83d43a3adcb89202f692ea50576f' },
  { suffix: 'PAJ', opening: 9, bytes: 77828, sha256: 'f9feb5864caa8f74d9b227a254dce2ef159f0077fce0f15ad1406e62d532b4c6' },
  { suffix: 'PAK', opening: 10, bytes: 72832, sha256: '6dcc90fc0e661b34f6f7ef72f3269e182010cb2228d3341d08cdef8dae553a71' },
];
export const hanjingtangImages = Object.fromEntries(rubbingRecords.map(record => {
  const itemId = `K2D000204N000000000${record.suffix}`;
  const src = `${publicRoot}hanjingtang-chunhua-volume1-${itemId}.jpg`;
  return [`hanjingChunhua${record.suffix}`, {
    src, fullSrc: src, width: 1000, height: 749, bytes: record.bytes, sha256: record.sha256,
    kind: 'historic-rubbing',
    title: b(`御製重刻淳化閣帖（一）· 第 ${record.opening} 开`, `Imperial Chunhua Modelbooks, volume one · Opening ${record.opening}`),
    caption: b('馆藏拓本的完整数字照片，保留页边与拍摄校准条。图中为纸上拓印；建筑中的浅刻白石表面另属复原处理。', 'The complete digital photograph of the museum rubbing retains its margins and photographic calibration strip. It shows a paper impression; the shallow-cut white stone in the model is a separate interpretation.'),
    source: catalogue, originalUrl: `https://iiifod.npm.gov.tw/iiif/2/K2D%2F${itemId}/full/1000,/0/default.jpg`,
    manifest: hanjingtangSources.hanjingNpmChunhua.manifest,
    provenanceUrl: `${src}.json`,
    credit: b('御製重刻淳化閣帖（一） 冊。国立故宫博物院，台北。', 'Imperial Recarving of the Chunhua Pavilion Modelbooks, volume one. National Palace Museum, Taipei.'),
    objectNumber: '故帖000204N000000000', albumOpening: record.opening,
    originalDate: b('清乾隆朝：1769 年奉敕重刻，册含 1772 年序文；本纸张拓印时间未定。', 'Qianlong reign: recarving ordered in 1769; the album includes a 1772 preface. The date of this paper impression is unconfirmed.'),
    originalAuthors: b('清内府奉敕重刻；各帖沿用历史题名，不能据此认定为题名作者的亲笔。', 'Recarved by imperial order in the Qing court; historical attributions within the modelbook do not establish autograph authorship.'),
    license: 'CC0 1.0 — museum low-resolution image policy',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', rightsEvidenceUrl: catalogue,
    rightsNote: b('本图 749,000 像素，依馆方低阶图像 CC0 声明使用。IIIF 清单另列政府资料开放授权条款；原始来源记录保留该项。', 'This 749,000-pixel image falls under the museum’s CC0 policy for low-resolution images. The IIIF manifest also lists the Government Data Open License; the provenance record preserves that notice.'),
    generated: false, publicBundled: true, visuallyVerified: true, pixelTransform: 'none',
    rightsReviewedAt: '2026-09-12',
  }];
}));

export const hanjingtangEntries = [
  {
    id: 'hanjingtang', region: 'changchunyuan', kind: 'architecture', title: b('含经堂', 'Hanjingtang'),
    lead: b('长春园中，一条由宫门深入园居的轴线。', 'A route from the palace gate into the garden residences of Changchunyuan.'),
    sign: b('穿过宫门，循院落向北，走近藏帖与园居。', 'Pass through the palace gate and follow the courts north toward calligraphy and garden life.'),
    paragraphs: [
      b('含经堂位于长春园中部。中路由南面的宫门进入，经含经堂、淳化轩至蕴真斋；出北院门，可以通向临水的得胜概。东西两路与中轴院落相连。', 'Hanjingtang occupied central Changchunyuan. Its central route led north from the palace gate through Hanjingtang and Chunhuaxuan to Yunzhenzhai, then onward to the waterside hall Deshenggai. Eastern and western routes joined these axial courts.'),
      b('含经堂主殿为七开间重檐歇山建筑。其南侧广场设三座琉璃牌楼，入宫门后以影壁转折视线；两侧有梵香楼、霞翥楼等建筑。', 'The seven-bay main hall had a double-eave hip-and-gable roof. Three glazed archways stood in the square to the south. Beyond the palace gate, a spirit screen redirected the approach, while Fanxianglou and Xiazhulou stood to either side.'),
    ],
    sources: ['hanjingWang2015', 'hanjingSunSite'], related: ['chunhuaxuan', 'sanyouxuan', 'hanjingtang-courts', 'waterways'], images: [],
    note: b('当前单体研究表现淳化轩、三友轩建成后的乾隆时期核心院落。北部附属院落及 1814 年东路戏场改建尚未合入，不能据此认作完整的 1859—1860 年景群。', 'The study presents the Qianlong-period core after Chunhuaxuan and Sanyouxuan were built. Northern subsidiary courts and the 1814 theatre alterations on the east are not yet included; this is not the complete ensemble of 1859–1860.'),
  },
  {
    id: 'chunhuaxuan', region: 'changchunyuan', kind: 'architecture', title: b('淳化轩与一百四十四石', 'Chunhuaxuan and its 144 inscription stones'),
    lead: b('廊墙藏石，拓本让书迹传向园外。', 'Stone inscriptions lined the galleries; rubbings carried their calligraphy beyond the garden.'),
    sign: b('沿廊读石，再从拓本细看笔画。', 'Read the gallery stones, then look closely at the brush forms preserved in rubbings.'),
    paragraphs: [
      b('淳化轩面阔七间、进深三间，设有室内仙楼。含经堂与淳化轩之间的二十四间廊庑，镶嵌一百四十四块《钦定重刻淳化阁帖》石刻；遗址出土的残石为汉白玉。', 'Chunhuaxuan was seven bays wide and three bays deep, with an interior mezzanine. Twenty-four gallery bays between it and Hanjingtang held 144 stones of the imperially recarved Chunhua Modelbooks. Excavated fragments are white marble.'),
      b('馆藏册页保留 1769 年奉敕重刻的记载及 1772 年《淳化轩记》。后者说明，为安置帖石而利用含经堂后方回廊，并将原有蕴真斋向北移动，在旧址扩建淳化轩。', 'The museum album records the 1769 recarving order and includes the 1772 account of Chunhuaxuan. That account links the building to the storage of inscription stones in the galleries behind Hanjingtang: Yunzhenzhai was moved north and Chunhuaxuan enlarged on its former site.'),
    ],
    sources: ['hanjingSunSite', 'hanjingWang2015', 'hanjingNpmChunhua'], related: ['hanjingtang', 'sanyouxuan', 'hanjingtang-courts'],
    images: ['hanjingChunhuaPAI', 'hanjingChunhuaPAJ', 'hanjingChunhuaPAK'],
    note: b('展示选用国立故宫博物院三张完整原图，其六个页面区域在一百四十四块模型石板上重复使用。原石全文、逐石顺序与具体位置尚未恢复；白石色泽及浅刻深度为建模推定。', 'Three complete images from the National Palace Museum supply six page regions, repeated across the model’s 144 stones. The complete texts, stone sequence and original placements remain unrecovered; the white stone colour and incision depth are modelling interpretations.'),
  },
  {
    id: 'sanyouxuan', region: 'changchunyuan', kind: 'architecture', title: b('三友轩', 'Sanyouxuan'),
    lead: b('松、竹、梅，串联轩内雕饰与窗外园景。', 'Pine, bamboo and plum joined interior ornament to the garden beyond the windows.'),
    sign: b('看圆光罩上的三友，也看窗外的叠石。', 'Look for the Three Friends on the circular screen and the rock garden beyond.'),
    paragraphs: [
      b('三友轩位于淳化轩西侧，1770 年建成，为三开间小轩，三面环抱假山。王文涛报告的遗址测量约为面阔 11.1 米、进深 7.2 米，台面约 11.9 × 8.3 米。', 'West of Chunhuaxuan, the three-bay Sanyouxuan was completed in 1770 and enclosed by rockeries on three sides. Wang Wentao reports approximate site measurements of 11.1 by 7.2 metres, with a platform about 11.9 by 8.3 metres.'),
      b('史料记载轩外植松、竹、梅，室内安装以三友为题的大玻璃；西次间设高低炕与圆光罩，东次间设落地罩和木炕。这些安排让园景、雕饰与起居相互呼应。', 'Records describe pine, bamboo and plum outside, with large glazed panels carrying the same themes inside. The western side bay had raised and lower platforms and a circular screen; the eastern bay had a floor-standing screen and a wooden platform.'),
    ],
    sources: ['hanjingWang2015', 'hanjingDpmSanyou'], related: ['hanjingtang', 'chunhuaxuan', 'hanjingtang-courts'], images: [],
    note: b('屋顶曲线、雕花纹样与石山个体仍为推定。故宫宁寿宫花园的同名建筑建于 1774 年，只作比较，其东西不同的特殊屋形并未移植为本址史实。', 'The roof profile, carved patterns and individual rocks remain inferred. The palace building of the same name, built in 1774, serves only as a comparison; its unusual asymmetric roof is not transferred here as a historical fact.'),
  },
  {
    id: 'hanjingtang-courts', region: 'changchunyuan', kind: 'landscape', title: b('图档中的三路院落', 'Three routes in the historic drawings'),
    lead: b('正中的秩序与两侧园居，随着年代逐步改变。', 'The central axis and flanking garden residences changed over time.'),
    sign: b('读图时，先辨年代，再循中、东、西三路。', 'Identify the drawing’s date, then trace the central, eastern and western routes.'),
    paragraphs: [
      b('样式雷图档与建筑史研究显示，南部宫廷空间较为规整，中轴向北延伸，两侧逐渐转入不同的起居与园林空间。西路三友轩与叠石相依，东路的戏场又经历了嘉庆时期的改建。', 'Yangshi Lei drawings and architectural research show a formal southern court and a northward central axis, with different residential and garden spaces to either side. Sanyouxuan nestled in rockeries on the west, while the theatre area on the east was altered during the Jiaqing reign.'),
      b('故宫学刊收录的乾隆图、嘉庆贴改图与淳化轩平面，可比较建筑关系与后来的变化。图上的改线、贴签需要结合档案年代阅读，不能一律当作同一时期已经建成的状态。', 'Reproductions in the Palace Museum study include Qianlong drawings, a revised Jiaqing drawing and the plan of Chunhuaxuan. Their altered lines and pasted annotations must be read with dated records, rather than treated as one completed historical state.'),
    ],
    sources: ['hanjingWang2015', 'hanjingSunSite'], related: ['hanjingtang', 'chunhuaxuan', 'sanyouxuan', 'waterways'], images: [],
    note: b('当前坐标按图版关系作比例配准。1744 年《圆明园四十景图》并不记录这组较晚形成的长春园院落；未经辨读的尺寸数字也没有作为实测数据使用。', 'Current coordinates are proportionally aligned from the reproduced plans. The 1744 Forty Scenes do not record this later Changchunyuan ensemble, and unreadable dimension figures have not been used as survey data.'),
  },
];

export const hanjingtangSigns = Object.fromEntries(hanjingtangEntries.map(entry => [entry.id, { title: entry.title, text: entry.sign }]));
export { hanjingtangSources as sources, hanjingtangImages as images, hanjingtangEntries as entries };
