const b=(zh,en)=>({zh,en});

export const dagongmenMuseumSources={
  dagongmenHeStudy:{
    title:b('贺艳 · 再现圆明园：正大光明','He Yan · Reconstructing Yuanmingyuan: Zhengda Guangming'),
    url:'https://www.dpm.org.cn/explode/others/210506.html',
    kind:b('故宫博物院刊载建筑史研究 · 《紫禁城》2011年第6期','Architectural research published by the Palace Museum · Forbidden City, June 2011'),
  },
  dagongmenHeGate:{
    title:b('大宫门形制与前朝区关系 · 原刊第24页','The main gate and front-court arrangement · Original p. 24'),
    url:'https://img.dpm.org.cn/Uploads/File/pdf/e0/6e/fb/e06efbed79a6959be7fd70460c894d9f.pdf',
    kind:b('机构研究原页 · 五开间、八字看墙、倒T御路','Institutional research page · Five bays, splayed walls and the inverted-T road'),
  },
  dagongmenHeAxis:{
    title:b('门与影壁的距离 · 原刊第33页','Gate–screen-wall distance · Original p. 33'),
    url:'https://img.dpm.org.cn/Uploads/File/pdf/fd/97/24/fd9724a25bcf7f39e04a104648bf47a2.pdf',
    kind:b('图档与遗址关系释读 · 该页图13-1另有官方更正','Interpretation of archival and site evidence · Figure 13-1 was subsequently corrected'),
  },
  dagongmenHeScreen:{
    title:b('大影壁的比较复原 · 原刊第36页','Comparative reconstruction of the screen wall · Original p. 36'),
    url:'https://img.dpm.org.cn/Uploads/File/pdf/d8/5a/79/d85a79b098696a8d82315eb2f77cbbed.pdf',
    kind:b('机构研究原页 · 长度注记与比较实例；图18另有官方更正','Institutional research page · Length annotation and comparisons; figure 18 was subsequently corrected'),
  },
  dagongmenHeErratum:{
    title:b('《再现圆明园——正大光明》官方配图更正 · 第49页','Official figure corrections to the Zhengda Guangming study · P. 49'),
    url:'https://img.dpm.org.cn/Uploads/File/pdf/bf/4a/f9/bf4af9c9d8612c467908945b7a702fd4.pdf',
    kind:b('官方勘误 · 新图替换图10、12、13-1、18、23','Official erratum · Replacements for figures 10, 12, 13-1, 18 and 23'),
  },
};

export const dagongmenMuseumEntries=[{
  id:'dagongmen-entrance',region:'yuanmingyuan',kind:'architecture',
  title:b('大宫门入口','Dagongmen: the main entrance'),
  lead:b('五开间门殿与远处影壁，标出御园的礼仪入口。','A five-bay gateway and a distant screen wall marked the garden’s ceremonial entrance.'),
  sign:b('先数柱间，再看门洞。','Count the bays, then look at the openings.'),
  paragraphs:[
    b("大宫门是圆明园本园南面的正门。它由南向五开间门殿、两侧八字看墙和带门罩的便门组成，门额题写“圆明园”。","Dagongmen was the southern main entrance to Yuanmingyuan proper. The south-facing, five-bay gate hall was flanked by splayed walls and hooded side doors. Its plaque bore the garden’s name."),
    b("数一数正面的柱间：传统建筑的“间”是两根柱子之间的一段空间。五开间描述的是建筑的分段，并不等于五个通行门洞。","Count the spaces between the front columns. In traditional Chinese architecture, a bay is the space between two columns. Five bays describes the building’s divisions, rather than five separate doorways."),
    b("门前白石御路呈倒T形。沿中轴向南，园门与大影壁相距约205米；这一关系来自已发表的图档与遗址研究。长长的御路让门与影壁共同构成一个开阔的入口空间。","The white-stone imperial approach formed an inverted T. Along its southward axis, the gate and great screen wall stood about 205 metres apart, according to published archival and site research. The long approach connected them across an expansive entrance space."),
    b("大影壁的图档注记记有长度“十三丈”，研究者换算为41.6米。复原研究为它配置了红灰墙身、须弥座与灰瓦屋帽；这些细部的依据属于比较复原。","An archival annotation gives the great screen wall’s length as thirteen zhang, converted by the researchers to 41.6 metres. Its rendered wall, moulded base and grey-tiled cap follow a comparative reconstruction in that study."),
    b("走近门殿，可以留意灰瓦的层层搭接、檐下彩画和红柱与石基的衔接。本景采用卷棚歇山形制来表现屋面，具体曲率、木构和彩画细部包含比例推定。","At the gateway, look for the overlapping grey tiles, painted beams beneath the eaves, and the junctions of red columns and stone bases. This scene uses a rolled hip-and-gable roof; its precise curves, timber details and paintwork include proportional interpretation."),
    b("大宫门只是进入前朝区的第一道门。史料中的中轴继续向北，经二宫门“出入贤良门”通向正大光明殿；二宫门与大宫门是两座不同的建筑。","Dagongmen was the first gateway into the front-court area. The documented axis continued north through Ergongmen, named Churu Xianliangmen, toward Zhengda Guangming Hall. Ergongmen and Dagongmen were distinct buildings."),
  ],
  sources:['dagongmenHeStudy','dagongmenHeGate','dagongmenHeAxis','dagongmenHeScreen','dagongmenHeErratum'],
  related:['ergongmen-gate','front-court-walk','zhengda-guangming-hall','three-gardens','jiuzhou-qingyan-core'],images:['dagongmenR2Front'],
  note:b("复原说明：入口关系按道咸时期的研究呈现，并采用官方配图勘误。大宫门完整原尺寸尚未确认；三处板门开启、门扇角度、部分构造及材质为展示或比例推定，匾额用现代字体转写，非御笔摹本。二宫门的精确尺寸未移用于此。","Reconstruction note: the entrance arrangement follows research on the Daoguang–Xianfeng period and its official figure corrections. Complete original Dagongmen dimensions remain unresolved. The three opened doorways, door angles and some structural and material details are interpretive; the plaque uses modern lettering, not a facsimile of imperial calligraphy. Exact dimensions documented for Ergongmen were not applied here."),
}];

// Scene placement is a separate contemporary exhibition decision.
dagongmenMuseumEntries[0].note.zh+=' 当前场景位于比例园图的宫廷分区示意锚点，不是历史测绘坐标；园墙御路交界的通行口及地面衔接为当代展示设计。三建筑的位置、院落间距与东侧游览旁路为当代数字展陈设计。';
dagongmenMuseumEntries[0].note.en+=' The scene uses an illustrative court-area anchor on the proportional garden diagram, not surveyed historical coordinates. The route opening in that diagram wall and the ground transition are contemporary exhibition design. The three-building placement, court spacing and eastern visitor paths are contemporary digital exhibition design.';
export const dagongmenMuseumImages={
 dagongmenR2Front:{
  src:'/images/yuanmingyuan/dagongmen-r2-front.png',
  title:b('大宫门 · 数字复原示意','Dagongmen · Digital reconstruction'),
  caption:b('原生渲染，非史料图像。模型尺度与细部包含比例推定。','Native render, not a historical image. Model dimensions and details include proportional interpretation.'),
  credit:b('本项目数字复原 · R2 原生正面图','Project digital reconstruction · R2 native front view'),
  source:'/images/yuanmingyuan/dagongmen-r2-front.provenance.json',
  license:'Project-authored digital reconstruction render',width:3520,height:2200,
  role:'digital-reconstruction-not-historical-evidence',publicBundled:true,
  sha256:'cfb9df9f2876833597108e974697b1c1e647f363399641de2533f8f9fdffc649',
 },
};
