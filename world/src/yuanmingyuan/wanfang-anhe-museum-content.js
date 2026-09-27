// Exhibit copy is independent of model acceptance and of guide world positions.
const b=(zh,en)=>({zh,en});

export const wanfangAnheMuseumSources={
  wanfang2016:{
    title:b('刘仁皓、刘畅、赵波 · 万方安和九咏空间再探','Liu Renhao, Liu Chang and Zhao Bo · A further study of Wanfang Anhe’s Nine Poems spaces'),
    url:'https://www.dpm.org.cn/journal/246859.html',
    kind:b('故宫博物院院刊 · 2016年第2期，16—36页；对早期研究的补充与商榷','Palace Museum Journal · 2016, no. 2, pp. 16–36; additions and revisions to earlier research'),
  },
  wanfang2016Plans:{
    title:b('部位称谓、图样与烫样 · 原刊24—29页','Spatial analysis, drawings and architectural model · Original pp. 24–29'),
    url:'https://www.dpm.org.cn/Uploads/File/2018/06/01/u5b112236babf8.pdf#page=9',
    kind:b('2016年研究分析图与档案图转印；27页转引同治重修估单','Modern analytical diagrams and reproduced archival drawings; p. 27 quotes a Tongzhi rebuilding estimate'),
  },
  wanfang2008Roof:{
    title:b('端木泓 · 万方安和烫样覆顶与揭顶图','Duanmu Hong · The Wanfang Anhe model with its roof on and removed'),
    url:'https://www.dpm.org.cn/Uploads/File/pdf/58/dc/56/58dc560ddf50abdbc41ba39aca8a867f.pdf',
    kind:b('故宫博物院院刊 · 2008年第2期，53页，图九；覆顶与揭顶模型照片','Palace Museum Journal · 2008, no. 2, p. 53, figure 9; model photographs with the roof on and removed'),
  },
  wanfangHkpm:{
    title:b('香港故宫文化博物馆 · 万方安和殿烫样','Hong Kong Palace Museum · Architectural model of Wanfang Anhe'),
    url:'https://www.hkpm.org.hk/tc/exhibition/the-hong-kong-jockey-club-series-yuan-ming-yuan-art-and-culture-of-an-imperial-garden-palace',
    kind:b('机构展览图文；所述为1873—1874年重修方案模型','Institutional exhibition account; the model represents a rebuilding proposal of 1873–1874'),
  },
  wanfangHkpmReplica:{
    title:b('官方导赏8003 · 万方安和殿烫样（复制品）','Official audio guide 8003 · Wanfang Anhe architectural model (replica)'),
    url:'https://www.hkpm.org.hk/tc/visit/audio-guide/g8-yuan-ming-yuan',
    kind:b('香港故宫明确标注展出复制品；不可视作毁前建筑实测影像','The Hong Kong Palace Museum identifies the displayed replica; it is not a measured record of the pre-destruction building'),
  },
};

export const wanfangAnheMuseumEntries=[
  {
    id:'wanfang-anhe',region:'yuanmingyuan',kind:'architecture',
    title:b('万方安和','Wanfang Anhe'),
    lead:b('四支折转的水上园居，让廊下的视线不断遇见水。','Four turning wings brought the water into view from many parts of this garden residence.'),
    sign:b('数一数柱间，看看水如何进入建筑之间。','Count the bays, then follow the water between the wings.'),
    paragraphs:[
      b('万方安和是圆明园四十景之一。建筑立于水中，四条支路从中央展开并折转，水面伸入各支之间；南面有码头，桥梁则把建筑与陆地相连。香港故宫的介绍指出，这里曾是雍正帝常用的寝宫。','One of the Forty Scenes of Yuanmingyuan, Wanfang Anhe stood in the water. Four wings extended from the centre and turned, leaving inlets between them. A landing served boats on the south, while bridges connected the building to land. The Hong Kong Palace Museum describes it as a residence frequently used by the Yongzheng emperor.'),
      b('2016年的建筑史研究将它概括为三十三间：外围四条支路各五间，中央十字部分十三间。“间”指柱间的分段，并不等于三十三个彼此封闭的房间。周廊把这些空间与水边联系起来。','The 2016 architectural study describes thirty-three bays: five in each outer wing and thirteen in the central cross. A bay is a space between columns, not necessarily a separate enclosed room. The surrounding veranda connected these spaces with the water’s edge.'),
      b('读平面时，可以先找中央，再追踪四支的折转与水凹口。论文图十二为帮助讨论而绘制的部位称谓图，不是清代原图；它应与文中刊载的样式雷图样一起阅读。','To read the plan, find the centre, then trace the four turning wings and the inlets between them. Figure 12 in the study is a modern analytical diagram, not a Qing drawing. It should be read alongside the reproduced Yangshi Lei plans.'),
    ],
    sources:['wanfang2016','wanfang2016Plans','wanfangHkpm'],
    related:['wanfang-anhe-roof','wanfang-anhe-nine-poems','wanfang-anhe-evidence','waterways'],
    images:['wanfangAnheOverview','wanfangAnhePlan'],
    note:b('数字模型以文献和图版解释建筑关系；尺度换算与缺失细节包含推定，不能称为1860年前建筑的完整实测复原。','The digital model interprets relationships recorded in texts and images. Its scale conversion and missing details involve inference; it is not a complete measured reconstruction of the pre-1860 building.'),
  },
  {
    id:'wanfang-anhe-roof',region:'yuanmingyuan',kind:'architecture',
    title:b('相接的卷棚屋面','A connected roof of rounded profiles'),
    lead:b('屋面随着支路折转，廊下空间沿水展开。','The roof follows the turning wings, with verandas beside the water.'),
    sign:b('沿屋面看转角，再看廊下的开敞空间。','Follow the roof around a turn, then look into the veranda.'),
    paragraphs:[
      b('卷棚屋面的上部以圆转曲线相接。万方安和的覆顶烫样照片显示，四支屋面向中央连续连接，中央并非另立一座高耸的亭子。照片可以帮助辨认整体形制，却不能给出每个节点的精确尺寸。','A juanpeng roof has a rounded upper profile. Published photographs of the roofed architectural model show the four wings joining continuously at the centre, rather than surrounding a separate tall pavilion. The photographs clarify the overall form, but do not measure every junction.'),
      b('2016年论文转引同治重修估单，记有“七檩外卷棚”“中井十字脊”及“四转角四歇山顶”。这些词将屋面、中央交接与转角联系起来；不能据此把每一处折弯都画成独立的小亭顶。','A Tongzhi rebuilding estimate quoted in the 2016 study describes a seven-purlin juanpeng roof, a central crossing of ridges, and four hip-and-gable roofs at the turns. These terms link the wings, central junction and corners; they do not justify placing a separate pavilion roof at every bend.'),
      b('柱廊形成屋内与水面之间的过渡。看复制品照片时，还要注意房屋、桥和码头的对应：研究指出，现存烫样曾有构件移位，不能照照片中每一处栏杆或门的位置直接复原。','The colonnaded veranda mediates between the rooms and the water. When viewing model photographs, also compare the doors, bridges and landing. Researchers report displaced parts in the surviving model, so each visible railing or doorway cannot simply be copied as an original position.'),
    ],
    sources:['wanfang2016Plans','wanfang2008Roof','wanfangHkpm','wanfangHkpmReplica'],
    related:['wanfang-anhe','wanfang-anhe-evidence'],images:['wanfangAnheRoof','wanfangAnheOverview'],
    note:b('屋面曲率、出檐、檩位、色彩和细部构造仍含建模推定。机构照片中的覆顶模型是形态参考，不是清代屋顶的测绘图。','Roof curvature, eave projection, purlin placement, colours and construction details remain partly interpretive. Institutional photographs of the roofed model provide a reference for form, not a measured survey of the Qing roof.'),
  },
  {
    id:'wanfang-anhe-nine-poems',region:'yuanmingyuan',kind:'history',
    title:b('九咏与室内空间','Nine Poems and the rooms they describe'),
    lead:b('诗名、匾额与图样相互参照，房间的位置却并非总有定论。','Poems, plaques and plans can illuminate one another, though room locations are not always settled.'),
    sign:b('一首诗能帮我们找到一间屋吗？','How can a poem help us locate a room?'),
    paragraphs:[
      b('乾隆二十九年（1764）的《万方安和九咏》，成为后人理解这座园居的重要线索。研究者把诗文、匾额名称、宫廷记录和样式雷图样放在一起，尝试寻找文字所指的具体空间。','The Qianlong emperor’s Nine Poems on Wanfang Anhe, composed in 1764, provide clues to the residence. Researchers compare the poems and plaque names with court records and Yangshi Lei drawings to locate the spaces described.'),
      b('例如“佳气迎人”，2016年研究结合炕床记载、隔扇图与烫样，讨论一处起居空间。相邻的“假仙楼”则利用中槛和栏板营造上下两层的视觉印象，让真实建筑与室内幻景相接。','For example, the 2016 study interprets Jiaqiyingren, “Welcoming Auspicious Air,” through records of a raised bed, partition drawings and the model. An adjacent false upper storey used a cross rail and balustrade to suggest two levels, joining built space with visual illusion.'),
      b('这不是一张已经无争议的房间清单。2016年论文对2008年的研究补充了图纸编号、设计分期和部分空间对应，也讨论了烫样构件的移位。不同方案与保存状态，需要和诗文一起辨读。','This is not an uncontested room list. The 2016 paper revisits the 2008 study’s drawing numbers, design stages and some spatial identifications, and discusses displaced model components. Different proposals and later changes to the model must be considered alongside the poems.'),
    ],
    sources:['wanfang2016','wanfang2016Plans'],
    related:['wanfang-anhe','wanfang-anhe-evidence'],images:['wanfangAnheVeranda','wanfangAnhePlan'],
    note:b('九咏空间的具体对应属于建筑史研究解释。这里介绍其方法与争议，不把晚清重修图上的全部内装都当作1764年或1860年前的确定状态。','Specific identifications of the Nine Poems spaces are research interpretations. This exhibit explains the method and debate, without treating every interior on a late-Qing rebuilding plan as a certain record of 1764 or the pre-1860 state.'),
  },
  {
    id:'wanfang-anhe-evidence',region:'yuanmingyuan',kind:'history',
    title:b('图画、遗址与重修烫样','Paintings, remains and a rebuilding model'),
    lead:b('留下来的资料年代不同，也回答着不同的问题。','Surviving records come from different periods and answer different questions.'),
    sign:b('图画、遗址和烫样，各自留下了什么？','What can a painting, a site and a model each tell us?'),
    paragraphs:[
      b('1744年的《圆明园四十景图》已经描绘万方安和，可以用来观察早期建筑与水景的关系。绘画不是按比例测量的图纸，也不能独自代表此后直到1860年前的所有变化。','Wanfang Anhe appears in the Forty Scenes of Yuanmingyuan of 1744, recording an early relationship between the building and water. A painting is not a measured plan, nor does it alone record every change up to 1860.'),
      b('建筑在1860年遭到毁损。2016年论文中的现场踏勘部分记录了台基、柱础、码头和涵洞，也辨认出后补部分。遗址上的不同年代痕迹，应与已经失去的木构建筑分开理解。','The building was damaged in the destruction of 1860. The site investigation reported in the 2016 paper records the platform, column bases, landing and water passages, alongside later repairs. These layers at the site must be distinguished from the lost timber building.'),
      b('香港故宫将所介绍的烫样关联到1873—1874年的同治重修方案。它保存的是为重建而制作的建筑模型信息，不是1860年前的现场测绘，也不能单凭模型证明重修方案全部落成。','The Hong Kong Palace Museum associates the model with a Tongzhi rebuilding proposal of 1873–1874. It records a design prepared for rebuilding, rather than a survey made before 1860. The model alone cannot establish that the whole proposal was built.'),
      b('今天在香港故宫的官方导赏中，这件展品明确标为复制品。2016年论文的图十二又是现代研究分析图。原址、清代图像、晚清重修模型和当代复制品，各有价值，却不能混作同一年代的证据。','The Hong Kong Palace Museum’s official guide identifies the displayed object as a replica. Figure 12 in the 2016 paper is another layer: a modern analytical diagram. The site, Qing images, late-Qing rebuilding model and present-day replica are all valuable, but are not evidence from a single moment.'),
    ],
    sources:['wanfang2016','wanfang2016Plans','wanfangHkpm','wanfangHkpmReplica'],
    related:['wanfang-anhe','wanfang-anhe-nine-poems','three-gardens'],images:['wanfangAnhePlan','wanfangAnheOverview'],
    note:b('模型以每尺0.32米作工作换算，同治文字所述的开间、周廊和柱高据此表达；这一换算与屋面、材料等补全均是展示假设，不是毁前实测尺寸。','The model uses a working conversion of 0.32 metres per chi for the bay, veranda and column dimensions quoted in Tongzhi records. This conversion and the completion of roof and material details are display assumptions, not measured pre-destruction dimensions.'),
  },
];

// Original native renders and a vector diagram explain the digital model.
// Historical references remain separate from the contemporary interpretation.
export const wanfangAnheMuseumImages={
  wanfangAnheOverview:{
    src:"/images/yuanmingyuan/wanfang-anhe/overview.png",width:3520,height:2200,
    title:b("万方安和：临水四支","Wanfang Anhe: four wings above the water"),
    caption:b("数字模型的俯瞰图。屋面沿四支折转，三个方向的桥梁与南侧码头连接水陆。颜色、材料与缺失细部为当代解释，图中水面为模型审查环境。","An overhead view of the digital model. The roof follows the turning wings; bridges on three sides and the southern landing connect land and water. Colours, materials and missing details are contemporary interpretations. The water shown belongs to the model review scene."),
    source:"/images/yuanmingyuan/wanfang-anhe/overview.png",
    credit:b('本站数字模型实机截图','Native render of this website’s digital model'),
    license:'Original model render · © Yaxin Luo',kind:'interpretive-model-render',publicBundled:true,
    originalDate:b('当代数字模型；不是清代影像或历史测绘资料。','Contemporary digital model; not a Qing image or historical survey.'),
  },
  wanfangAnheRoof:{
    src:"/images/yuanmingyuan/wanfang-anhe/roof-junction.png",width:3520,height:2200,
    title:b("卷棚屋面与中央交接","Rounded roofs and the central junction"),
    caption:b("数字模型近景，用于观察连续屋面、瓦垄与出檐的关系。造型参考已刊烫样图版；曲率、构造尺寸与材料细节仍包含建模推定。","A close view of the digital model showing the connected roofs, tile courses and projecting eaves. Published model photographs inform the form; curvature, construction dimensions and material details remain partly interpretive."),
    source:"/images/yuanmingyuan/wanfang-anhe/roof-junction.png",
    credit:b('本站数字模型实机截图','Native render of this website’s digital model'),
    license:'Original model render · © Yaxin Luo',kind:'interpretive-model-render',publicBundled:true,
    originalDate:b('当代数字模型；不是清代影像或历史测绘资料。','Contemporary digital model; not a Qing image or historical survey.'),
  },
  wanfangAnheVeranda:{
    src:"/images/yuanmingyuan/wanfang-anhe/veranda.png",width:3520,height:2200,
    title:b("柱廊、窗格与南面码头","The veranda, lattice windows and southern landing"),
    caption:b("数字模型中的柱廊与临水台阶。此图帮助观察廊下空间、窗格和码头的相接方式，不表示九咏各房间位置或室内陈设已经考定。","The veranda and waterside steps in the digital model. This view explains the relationship between the colonnade, lattice windows and landing; it does not establish the positions or furnishings of the Nine Poems rooms."),
    source:"/images/yuanmingyuan/wanfang-anhe/veranda.png",
    credit:b('本站数字模型实机截图','Native render of this website’s digital model'),
    license:'Original model render · © Yaxin Luo',kind:'interpretive-model-render',publicBundled:true,
    originalDate:b('当代数字模型；不是清代影像或历史测绘资料。','Contemporary digital model; not a Qing image or historical survey.'),
  },
  wanfangAnhePlan:{
    src:'/images/yuanmingyuan/wanfang-anhe/plan.svg',width:1120,height:1024,
    title:b('万方安和：分间与水院','Wanfang Anhe: bays and water inlets'),
    caption:b('本站按数字模型绘制的平面关系示意。中央十三间与外围四支各五间用两种颜色区分；格线表示柱间，不是已经考定的九咏房间边界。三座桥、南面码头和水凹口帮助理解水陆关系。','An original diagram drawn from the digital model. Two colours distinguish the thirteen central bays from the four wings of five bays. Lines mark bays, not established boundaries of the Nine Poems rooms. Three bridges, the southern landing and the inlets explain the relationship with the water.'),
    source:'/images/yuanmingyuan/wanfang-anhe/plan.svg',
    credit:b('本站绘制 · 依据数字模型及故宫院刊研究','Diagram by this website · Based on the digital model and Palace Museum Journal research'),
    license:'Original diagram · © Yaxin Luo',kind:'interpretive-model-plan',publicBundled:true,
    originalDate:b('当代解释图；不是清代原图、实测图或已考定的毁前状态。','Contemporary interpretation; not a Qing drawing, measured survey or established pre-destruction state.'),
  },
};
export const wanfangAnheGuideTopics=Object.fromEntries(wanfangAnheMuseumEntries.map(entry=>[entry.id,{entry:entry.id,sign:entry.sign}]));
