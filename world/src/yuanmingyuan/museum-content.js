import {supplementalImages,supplementalEntryImages} from './museum-image-supplement.js';
import {fuhaiSources,fuhaiEntries,fuhaiImageCandidates} from './fuhai-museum-content.js';
import {hanjingtangSources,hanjingtangImages,hanjingtangEntries} from './hanjingtang-museum-content.js';
import {zhengjuesiSources,zhengjuesiEntries} from './zhengjuesi-museum-content.js';
import {haiyueMuseumImages} from './haiyue-museum-images.js';
import {haiyueMuseumSources,haiyueEntries} from './haiyue-museum-content.js';
import {jiuzhouMuseumSources,jiuzhouMuseumEntries,jiuzhouMuseumImages} from './jiuzhou-museum-content.js';
// Museum copy is independent of portfolio content and of model acceptance.
// Research and unresolved dimensions: docs/art/yuanmingyuan/research/.
const b=(zh,en)=>({zh,en});
export const museumRegions=[
  {id:'yuanmingyuan',title:b('圆明园本园','Yuanmingyuan'),subtitle:b('宫廷、湖岛与园居','Court, islands and garden life')},
  {id:'changchunyuan',title:b('长春园','Changchunyuan'),subtitle:b('湖山与西洋楼','Lakes and the Western Palaces')},
  {id:'qichunyuan',title:b('绮春园','Qichunyuan'),subtitle:b('相连的小园与水岸','Connected gardens and waterways')},
];
export const museumSources={
  ...haiyueMuseumSources,
  ...jiuzhouMuseumSources,
  ...fuhaiSources,
  ...hanjingtangSources,
  ...zhengjuesiSources,
  palaceAlbum:{title:b('故宫博物院 · 圆明园铜版画册','The Palace Museum · Album of Yuanmingyuan engravings'),url:'https://www.dpm.org.cn/collection/paint/228650.html',kind:b('馆藏图像 · 故00009171','Collection image · 故00009171')},
  palaceLecture:{title:b('故宫明清史研究所 · 西洋楼铜版图研究','The Palace Museum · Research on the Western Palace engravings'),url:'https://www.dpm.org.cn/learing_detail/379500.html',kind:b('机构研究介绍','Institutional research report')},
  threeGardens:{title:b('香港故宫文化博物馆 · 圆明园皇家园居文化','Hong Kong Palace Museum · Life in the Yuanmingyuan'),url:'https://www.hkpm.org.hk/sc/visit/audio-guide/g8-yuan-ming-yuan',kind:b('博物馆导赏','Museum interpretation')},
  gardenPlan:{title:b('王淑芳 · 三园地盘河道全图研究','Wang Shufang · Study of the three-garden waterways plan'),url:'https://www.dpm.org.cn/explode/others/203786.html',kind:b('故宫院刊 · 学术研究','Palace Museum Journal · Research')},
  water:{title:b('圆明园管理处 · 水资源综合可持续利用研究','Yuanmingyuan Park · Research on water resources'),url:'https://www.yuanmingyuanpark.cn/xs/ktsb/202005/t20200506_4402578.html',kind:b('园方刊载研究','Research published by the park')},
  jiuzhou:{title:b('国家图书馆 · 九州清晏样式雷图档','National Library of China · Yangshi Lei drawings of Jiuzhou Qingyan'),url:'https://www.nlc.cn/migrated/www.nlc.cn/newhxjy/wjsy/wjls/wjqcsy/wjd20q/d20qysltdjs/201011/P020101123720135260027.pdf',kind:b('馆藏图档介绍','Archive catalogue study')},
  geometry:{title:b('朱翊纶、曹新 · 西洋楼几何学设计方法','Zhu Yilun and Cao Xin · Geometric design of the Western Palaces'),url:'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html',kind:b('圆明园研究 · 2025','Yuanmingyuan Research · 2025')},
  materials:{title:b('孙晨露 · 西洋楼的中国元素','Sun Chenlu · Chinese elements in the Western Palaces'),url:'https://www.yuanmingyuanpark.cn/ymyyj/yj040/201612/t20161230_1330939.html',kind:b('具名研究','Authored research')},
  xieqiqu:{title:b('圆明园管理处 · 谐奇趣','Yuanmingyuan Park · Xieqiqu'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231511.html',kind:b('景点资料','Site description')},
  maze:{title:b('圆明园管理处 · 黄花阵','Yuanmingyuan Park · Huanghuazhen'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231510.html',kind:b('史图与现代修复对照','Historic image and modern rebuilding')},
  aviary:{title:b('圆明园管理处 · 养雀笼','Yuanmingyuan Park · Yangquelong'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231509.html',kind:b('景点资料','Site description')},
  aviaryArchaeology2016:{title:b('北京市文物研究所 · 养雀笼考古简报','Beijing Institute of Cultural Relics · Yangquelong excavation summary'),url:'https://wwj.beijing.gov.cn/bjww/resource/cms/article/wwbpdf/%E5%8C%97%E4%BA%AC%E6%96%87%E7%89%A92016.1.pdf#page=1',kind:b('《北京文物》2016 年第 1 期 · 第四版','Beijing Cultural Relics, 2016 no.1 · printed p.4')},
  fangwaiguan:{title:b('圆明园管理处 · 方外观','Yuanmingyuan Park · Fangwaiguan'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231508.html',kind:b('景点资料','Site description')},
  haiyantang:{title:b('圆明园管理处 · 海晏堂','Yuanmingyuan Park · Haiyantang'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231507.html',kind:b('建筑与水工说明','Architecture and waterworks')},
  yuanyingguan:{title:b('圆明园管理处 · 远瀛观','Yuanmingyuan Park · Yuanyingguan'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231506.html',kind:b('景点资料','Site description')},
  engravings:{title:b('MIT Visualizing Cultures · 西洋楼二十景','MIT Visualizing Cultures · Twenty Views of the European Palaces'),url:'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/ymy2_essay02.html',kind:b('历史图像与教学解说','Historic images and teaching commentary')},
  zodiac:{title:b('中国国家博物馆 · 鼠首与兔首铜像','National Museum of China · Rat and rabbit fountain heads'),url:'https://www.chnmuseum.cn/zp/zpml/gmww/202209/t20220907_257317.shtml',kind:b('原物馆藏说明','Original objects · Collection record')},
  stoneBodies:{title:b('曼彻斯特大学 · Yuanmingyuan tujing','University of Manchester · Yuanmingyuan tujing'),url:'https://www.digitalcollections.manchester.ac.uk/view/PR-CHCR-00457',kind:b('Chinese Crawford 457 · 馆藏档案','Chinese Crawford 457 · Archive')},
  durand:{title:b('Antoine Durand · 西洋楼复原研究，1988','Antoine Durand · Restitution des palais européens, 1988'),url:'https://www.persee.fr/doc/arasi_0004-3958_1988_num_43_1_1240',kind:b('实测与复原研究，非清代竣工图','Measured restitution, not a Qing as-built plan')},
  xianfashan:{title:b('圆明园管理处 · 线法山','Yuanmingyuan Park · Xianfashan'),url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231503.html',kind:b('景点资料','Site description')},
  xianfaqiaoCatalog:{title:b('国家图书馆 · 金勋《圆明园西洋楼图》目录','National Library of China · Catalogue of Jin Xun’s Western Palace views'),url:'https://www.nlc.cn/migrated/www.nlc.cn/newhxjy/wjsy/wjls/wjqcsy/wjd20q/d20qysltdjs/201011/P020101123721209322961.pdf',kind:b('1961 年回忆图册的馆藏介绍，印刷页 50','Catalogue of a retrospective album made in 1961, printed p.50')},
  xianfaqiaoPhotographs:{title:b('中国摄影家协会所刊 · 线法桥历史照片','Historic photographs of Xianfaqiao, reproduced on the China Photographers Association website'),url:'https://www.cpanet.org.cn/uploads/soft/141209/xtt1.pdf',kind:b('Bennett 摄影史试读，图 5.28、5.40；毁后影像','Bennett photography-history sample, figures 5.28 and 5.40; post-destruction photographs')},
};
export const museumImages={
  ...haiyueMuseumImages,
  ...jiuzhouMuseumImages,
  ...hanjingtangImages,
  fanghu1744:{...fuhaiImageCandidates.fanghu1744,src:'/images/yuanmingyuan/fanghu-1744.jpg',publicBundled:true,status:'verified-local-historic-image'},
  ...supplementalImages,
  haiyantangWest:{src:'/images/yuanmingyuan/haiyantang-west.jpg',width:4904,height:2867,title:b('海晏堂西面','West view of Haiyantang'),caption:b('《圆明园铜版画册》题铭“海晏堂西面”。历史版画展示整体关系，不能直接作为等比例测绘图。','The engraved title identifies the west view of Haiyantang. This historic perspective records relationships, not a measured elevation.'),source:'https://commons.wikimedia.org/wiki/File:圆明园铜版画册-8.jpg',credit:b('故宫博物院藏 · 经 Wikimedia Commons 提供','Collection of the Palace Museum · via Wikimedia Commons'),license:'PD-Art (PD-old-100); Public Domain Mark 1.0',kind:'historic-engraving'},
  haiyantangNorth:{src:'/images/yuanmingyuan/haiyantang-north.jpg',width:4944,height:2857,title:b('海晏堂北面','North view of Haiyantang'),caption:b('北面版画可见前楼、后部供水建筑与侧池之间的关系。','The north view records the relationship between the west hall, rear waterworks and side fountain.'),source:'https://commons.wikimedia.org/wiki/File:圆明园铜版画册-9.jpg',credit:b('故宫博物院藏 · 经 Wikimedia Commons 提供','Collection of the Palace Museum · via Wikimedia Commons'),license:'PD-Art (PD-old-100); Public Domain Mark 1.0',kind:'historic-engraving'},
  haiyantangSouth:{src:'/images/yuanmingyuan/haiyantang-south.jpg',title:b('海晏堂南面','South view of Haiyantang'),caption:b('以画面自身题铭确认方向；各册装订序号可能不同。','The direction follows the inscription in the image; numbering can differ between bound albums.'),source:'https://commons.wikimedia.org/wiki/File:圆明园铜版画册-10.jpg',credit:b('故宫博物院藏 · 经 Wikimedia Commons 提供','Collection of the Palace Museum · via Wikimedia Commons'),license:'PD-Art (PD-old-100); Public Domain Mark 1.0',kind:'historic-engraving'},
};
const northCourtExhibitionNote=b('历史图像可用于比照建筑与庭园的关系。本场景新增的北院花带、植物搭配、种植土和铺地材质属于当代展陈设计；其确切历史尺度、植栽与材质仍待考证。','Historical images provide a reference for the relationship between the buildings and gardens. The new north-court planting beds, plant mix, soil and paving materials are contemporary exhibition design; their exact historical dimensions, planting and materials remain to be established.');
const entry=(id,region,kind,title,lead,paragraphs,sources,related=[],images=[],note=null)=>({id,region,kind,title,lead,paragraphs,sources,related,images,note});
export const museumEntries=[
  ...haiyueEntries,
  ...jiuzhouMuseumEntries,
  ...zhengjuesiEntries,
  ...hanjingtangEntries,
  ...fuhaiEntries.map(item=>({...item,images:item.id==='fanghu-shengjing'?['fanghu1744']:[]})),
  entry('three-gardens','yuanmingyuan','landscape',b('一座园林，三园相接','Three connected gardens'),b('圆明园本园、长春园与绮春园，共同构成圆明三园。','Yuanmingyuan, Changchunyuan and Qichunyuan together form the three-garden complex.'),[
    b('这里既有处理政务的宫廷，也有沿湖而居的院落、园中园和宗教建筑。西洋楼位于长春园北部，是这片园林中的一部分。','The complex combined government, lakeside residences, enclosed gardens and religious buildings. The Western Palaces occupied part of northern Changchunyuan.'),
    b('本展览以 1859—1860 年毁损前为主要时间层，遇到不同年代的图档会另作说明。海上园岛和导游角色属于本站的当代展示设计；历史上的圆明园位于北京。','The principal time frame is 1859–1860, before the destruction. Sources from other periods are identified separately. The offshore setting and guide characters are contemporary exhibition devices; the historical gardens stood in Beijing.'),
  ],['threeGardens','gardenPlan'],['waterways','jiuzhou','western-palaces']),
  entry('waterways','yuanmingyuan','landscape',b('水构成的园林','A garden shaped by water'),b('湖、河、桥与水口，把分散的景群连接起来。','Lakes, channels, bridges and water gates connected the gardens.'),[
    b('福海、后湖等水面不只是建筑的背景，也承载舟行与游赏。观荷水面和通船水道的使用不同，水深与岸线因而不宜一概而论。','Fuhai and the Rear Lake supported boating and recreation as well as views. Lotus ponds and navigable channels served different purposes, with different depths and banks.'),
    b('阅读总图时，应把水陆边界、桥闸和建筑一起看。清代河道图和后来的重修计划并不属于同一时间层。','Read the water boundaries, bridges, sluices and buildings together. Qing waterway drawings and later rebuilding proposals describe different historical states.'),
  ],['water','gardenPlan'],['three-gardens','jiuzhou']),
  entry('jiuzhou','yuanmingyuan','architecture',b('九洲清晏与湖岛园居','Jiuzhou Qingyan and lakeside living'),b('宫廷轴线与环湖空间在这里相遇。','A courtly axis meets a landscape of water and islands.'),[
    b('国家图书馆保存的样式雷图档，记录了九洲清晏的地盘、尺寸与游廊立样。图上的贴签和改线，留下了建筑变化的线索。','Yangshi Lei drawings in the National Library of China record layouts, dimensions and gallery elevations at Jiuzhou Qingyan. Pasted annotations and revised lines reveal changes to the buildings.'),
    b('红线、贴签并不都表示已经建成的建筑。复原时需要分清旧样、改建方案与实际实施的时间。','Red lines and pasted notes do not all indicate completed work. Earlier layouts, proposed alterations and construction dates must be distinguished.'),
  ],['jiuzhou'],['jiuzhou-qingyan-core','jiuzhou-ruyi-bridge','waterways']),
  entry('western-palaces','changchunyuan','landscape',b('长春园中的西洋楼','The Western Palaces in Changchunyuan'),b('石雕、水法和几何花园，与中国式材料和园艺相遇。','Carved stone, fountains and geometric gardens met Chinese materials and horticulture.'),[
    b('白石并不是这里唯一的材料。彩色琉璃屋面、灰饰、砖墙、木构件与铜雕，共同形成建筑的层次。规则花坛与层剪圆柏沿建筑轴线组织，外围再过渡到自然园林。','White stone was only one material. Glazed roofs, plaster, brick, timber and copper sculpture contributed distinct surfaces. Formal beds and tiered cypresses followed architectural axes, meeting more natural planting beyond.'),
    b('各组楼、池和观赏点有各自的关系；海晏堂生肖水法与远瀛观前的大水法是两处不同的景点。','Each ensemble joined buildings, water and viewing positions in its own way. Haiyantang’s zodiac fountain and the Great Fountain before Yuanyingguan were separate sites.'),
  ],['materials','geometry'],['haiyantang','xieqiqu','yuanyingguan']),
  entry('haiyantang','changchunyuan','architecture',b('海晏堂','Haiyantang'),b('面向西方的正楼，与一整套水法和供水建筑相连。','A west-facing hall formed part of a larger fountain and waterworks ensemble.'),[
    b('正楼前，两翼阶梯向水池展开。中央石蚌、池岸坐像、雕刻栏杆和台基，共同构成正面景观；楼后另有工字形供水建筑。','Two stair wings open toward the western basin. The central stone shell, seated figures, balustrades and terraces form the foreground, while a separate I-shaped waterworks building stands behind.'),
    b('海晏堂的西、北、东、南面均见于西洋楼铜版组图。把几幅图结合起来，才能看清正面之外的纵深关系。','The engraved series records west, north, east and south views. Together they reveal a composition extending well beyond its familiar west facade.'),
  ],['haiyantang','palaceAlbum'],['zodiac-fountain','haiyantang-waterworks','historic-views'],['haiyantangWest','haiyantangNorth','haiyantangSouth'],b('目前的单体模型仍是比例研究；尺寸、雕刻细部与生肖排列尚待进一步校核。','The current standalone model is a proportional study. Dimensions, carving details and the order of the figures remain under review.')),
  entry('zodiac-fountain','changchunyuan','object',b('十二生肖水法','The zodiac fountain'),b('十二尊穿袍人身坐像，各配一个铜制兽首。','Twelve seated, robed human figures carried copper animal heads.'),[
    b('坐像分列海晏堂西池两翼，每侧六尊。石制身体与铜制兽首是不同的构件，铜口同时承担出水功能。','Six figures stood on either side of Haiyantang’s western basin. The stone bodies and copper heads were separate components, and water emerged from the animals’ mouths.'),
    b('国博的藏品说明介绍了按时辰轮流喷水、正午合喷的计时解释。博物馆中现存的原物、后来的复制品与当代艺术创作，需要分别辨认。','The National Museum describes a timekeeping scheme in which the heads spouted in turn, with all twelve at noon. Surviving originals, later replicas and contemporary artworks must be distinguished.'),
  ],['zodiac','stoneBodies'],['haiyantang','haiyantang-waterworks'],['haiyantangWest'],b('图中展示的是整组历史景观，并非十二件原物的独立照片。未获原物证据的造型保留推定说明。','This image records the ensemble, not separate photographs of the twelve original heads. Forms without original-object evidence remain identified as inferred.')),
  entry('haiyantang-waterworks','changchunyuan','waterworks',b('海晏堂的供水建筑','The waterworks behind Haiyantang'),b('壮观的喷泉，依靠看得见与看不见的水工设施。','The fountain depended on an architectural water-supply system.'),[
    b('后方的工字形建筑包含高置蓄水设施，俗称“锡海”的水池与供水机械有关。南北侧还有独立的小喷泉，它们与正楼一同组成海晏堂。','The I-shaped rear structure housed an elevated reservoir associated with the water-supply machinery. Separate smaller fountains stood to the north and south of the ensemble.'),
    b('“锡海”是蓄水设施的名称，并不是海景或游泳池。内部机械与管路若没有足够史料，只能作为讲解性示意。','The “tin sea” named a reservoir, not a sea view or swimming pool. Machinery and pipes lacking sufficient documentation can only be shown as explanatory interpretations.'),
  ],['haiyantang'],['haiyantang','zodiac-fountain'],['haiyantangNorth','haiyantangSouth']),
  entry('historic-views','changchunyuan','archive',b('从铜版图读建筑','Reading buildings through engravings'),b('一幅漂亮的透视图，能告诉我们什么？','What can a beautiful perspective image tell us?'),[
    b('西洋楼铜版图保存了建筑、庭院和水法的整体面貌。画中的题名、视向与成图年代，都是复原前必须核对的信息。','The Western Palace engravings preserve views of buildings, courts and fountains. Their inscriptions, viewing directions and production dates must be checked before reconstruction.'),
    b('透视会改变比例。现代测绘研究还需要结合遗址、遗存构件与历史照片；屋顶和部分装饰的补全，也可能只是研究假说。','Perspective changes apparent proportions. Measured restitution also uses remains, surviving fragments and historical photographs. Reconstructed roofs and ornament may still be hypotheses.'),
  ],['palaceLecture','durand'],['haiyantang','yuanyingguan'],['haiyantangWest']),
  entry('xieqiqu','changchunyuan','architecture',b('谐奇趣','Xieqiqu'),b('曲廊与亭子，让主楼向庭园展开。','Curved galleries and pavilions extend the hall into its gardens.'),[
    b('谐奇趣位于西洋楼西部。三层中央楼体连接两翼曲廊与八角亭，南北两面的台阶和水池各有形态。','In the western part of the precinct, a three-storey central building joined curved galleries and octagonal pavilions. Its north and south stairs and pools had distinct forms.'),
    b('南侧海棠形大池与北侧菊花形小池，不能用同一池形替代；其独立供水建筑也不同于海晏堂后楼。','The larger southern pool and smaller northern pool used different floral outlines. Xieqiqu’s own supply building was separate from Haiyantang’s waterworks.'),
  ],['xieqiqu'],['western-palaces','formal-gardens'],[],northCourtExhibitionNote),
  entry('xianfaqiao','changchunyuan','architecture',b('线法桥','Xianfaqiao'),b('谐奇趣前湖西岸，一道西洋门墙立在五孔桥上。','On the west bank of Xieqiqu’s forelake, a Western-style gate and screen stood above five arched openings.'),[
    b('园方研究将线法桥放在谐奇趣西侧；国图所列金勋图题进一步指向前湖西岸。它与西洋楼东端的线法山是不同地点。','Park research places the bridge west of Xieqiqu; the title in Jin Xun’s catalogue identifies the forelake’s west bank. It is separate from Xianfashan at the eastern end of the Western Palaces.'),
    b('十九世纪七十年代的照片可辨认五个低拱、横向雕屏和中央门洞，但照片已晚于焚毁。桥面、门墙和桥下水道需要分别理解。','Photographs from the 1870s show five low arches, a long carved screen and a central doorway, after the destruction. The deck, gateway and water beneath form distinct parts of the structure.'),
  ],['geometry','xianfaqiaoCatalog','xianfaqiaoPhotographs','palaceAlbum'],['xieqiqu','western-palaces','historic-views'],['xieqiquSouth'],b('配图是谐奇趣南面整景，桥仅在左缘局部出现。1961 年金勋图为回忆与参考绘制；桥的米制尺寸、精确朝向和毁前背面仍未考定。','The image shows Xieqiqu’s south view, with only part of the bridge at the left edge. Jin Xun’s 1961 drawing is retrospective; exact dimensions, orientation and the pre-destruction rear remain unresolved.')),
  entry('huanghuazhen','changchunyuan','landscape',b('黄花阵','Huanghuazhen'),b('以墙和路径构成的迷宫。','A maze of walls and paths.'),[
    b('黄花阵由雕花青砖矮墙组织回游路线，中心设置高台亭子。它并非全部由绿篱构成。','Low, ornamented grey-brick walls defined the maze, with a pavilion on a raised central platform. It was not simply a hedge maze.'),
    b('今天看到的修复景观可以帮助理解空间体验，但现代复建照片不能直接证明清代每个构件的形制。','The rebuilt garden helps explain its spatial experience, but photographs of the modern reconstruction do not establish every Qing-period detail.'),
  ],['maze'],['western-palaces','formal-gardens']),
  entry('yangquelong','changchunyuan','architecture',b('养雀笼','Yangquelong'),b('从两侧接近，会看到不同的建筑面貌。','Its two approaches offered different architectural faces.'),[
    b('养雀笼不只是一个铁丝鸟笼。历史图像中的西面呈中式牌楼语汇，东面则是西洋门庭；两侧形象共同构成园区转换。','The aviary was more than a wire cage. Historic views show a Chinese-style gateway to the west and a European-style frontage to the east, marking a transition within the gardens.'),
    b('考古发现包括汉白玉和彩色琉璃，鸟笼布局也与铜版画不同；后者可能反映了饲养规模的变化。','Excavations found white marble, coloured glaze and a cage layout differing from the engravings, possibly reflecting changes in the scale of bird keeping.'),
  ],['aviary','aviaryArchaeology2016'],['fangwaiguan','xieqiqu'],[],b('养雀笼新庭园研究中的四株松树、低植被、种植土与铺地细化属于当代馆景演绎；不代表已经考定的清代植栽、地面材质或米制尺度。','In the refined Yangquelong garden, the four pines, low planting, soil beds and paving treatment are contemporary museum-garden design. They do not establish Qing-period planting, paving materials or surveyed dimensions.')),
  entry('fangwaiguan','changchunyuan','architecture',b('方外观','Fangwaiguan'),b('两层楼体与左右曲阶构成紧凑的石构景观。','A two-storey hall and curved side stairs form a compact ensemble.'),[
    b('方外观的分段柱、门窗与两侧楼梯，赋予立面明确的节奏。五竹亭位于其南侧，与石楼形成轻重对照。','Articulated columns, windows and paired stairs give the facade its rhythm. Wuzhuting lies to the south, offering a lighter architectural counterpart.'),
    b('关于原有室内陈设的说法，需要和传说区分；这里优先介绍可由建筑图像与研究支持的内容。','Accounts of the interior need to be separated from later stories. This exhibit concentrates on architecture supported by images and research.'),
  ],['fangwaiguan','materials'],['wuzhuting','western-palaces']),
  entry('wuzhuting','changchunyuan','architecture',b('五竹亭','Wuzhuting'),b('五亭与连廊，是一组整体景观。','Five pavilions and their galleries form one composition.'),[
    b('五竹亭位于方外观南侧。观看历史图像时，应留意亭子之间的连接、轻巧的竹式构件与桥水庭的关系，而不是将其看作五个孤立的石亭。','South of Fangwaiguan, five pavilions were joined into a single arrangement. Historic images invite attention to their connections, light bamboo-like members and waterside setting, rather than five isolated stone structures.'),
  ],['engravings','materials'],['fangwaiguan','formal-gardens']),
  entry('yuanyingguan','changchunyuan','architecture',b('远瀛观','Yuanyingguan'),b('高台上的殿宇，是大水法北侧的建筑背景。','The hall on a raised terrace formed the northern backdrop to the Great Fountain.'),[
    b('毁前远瀛观是一组完整殿宇，并非今日遗址中熟悉的几根残柱。雕石柱、门窗、高台与前方水法共同构成观赏轴线。','Before the destruction, Yuanyingguan was a complete building ensemble, not only the surviving columns familiar today. Carved columns, openings, terrace and fountains formed a shared viewing axis.'),
    b('研究中对其建造年代存在不同解释：园方资料给出 1783 年，Durand 则讨论并采用更早的年代。展览保留这一分歧。','The construction date is debated: the park’s description gives 1783, while Durand discusses and adopts an earlier date. The exhibition preserves this disagreement.'),
  ],['yuanyingguan','durand'],['dashuifa','guanshuifa','historic-views'],[],b('测绘所得台基范围与建筑占地是两个不同尺寸；部分屋顶复原仍属于假说。','Surveyed terrace dimensions and building footprint are different measurements. Some proposed roof forms remain hypothetical.')),
  entry('dashuifa','changchunyuan','waterworks',b('大水法','Dashuifa · The Great Fountain'),b('从观水法向北，水景与远瀛观形成层层展开的对景。','Seen from the viewing throne, the fountain and Yuanyingguan form a layered composition.'),[
    b('中央石龛、跌水盘、动物池和两侧喷水设施，使水成为建筑的一部分。这组水法位于远瀛观南侧，不是海晏堂的十二生肖池。','A central stone niche, cascading basins, animal fountain and flanking structures made water part of the architecture. This fountain lay south of Yuanyingguan and was separate from Haiyantang’s zodiac basin.'),
    b('Durand 的测绘复原研究提供了庭院、侧池和高差的尺寸控制，同时也说明了动物基座中实测与推定位置的区别。','Durand’s measured restitution supplies controls for the court, side pools and level changes, while distinguishing located animal pedestals from inferred positions.'),
  ],['engravings','durand'],['yuanyingguan','guanshuifa']),
  entry('guanshuifa','changchunyuan','architecture',b('观水法','Guanshuifa · Viewing the fountains'),b('一处面向北方的观赏位置。','A viewing position facing north.'),[
    b('观水法位于大水法南侧。宝座、石屏、侧门与铜鹤共同构成前景，视线越过水池，投向喷泉和远瀛观。','South of the Great Fountain, a throne, stone screens, side gates and copper cranes framed the foreground. The view crossed the basin toward the fountains and Yuanyingguan.'),
  ],['engravings','durand'],['dashuifa','yuanyingguan']),
  entry('xianfashan','changchunyuan','landscape',b('线法山','Xianfashan'),b('一座为观看而筑的小山。','A small hill made for looking.'),[
    b('人工圆丘以螺旋步道通向山顶亭，东西门采用不同形态。它的趣味来自登高后的视线变化，不是险峻的天然山峰。','A spiral path climbs the artificial mound to a pavilion, with different gateways on its east and west sides. Its effect comes from changing viewpoints, not the drama of a rugged natural mountain.'),
    b('园方资料将丘高描述为约八米、盘道宽约一点五米。本模型以这些近似值组织登高路线；三圈盘道、门间距离、亭子比例和装饰细部仍属于复原解释，并非完整实测图。','The park describes a mound about eight metres high and a winding path about 1.5 metres wide. These approximate dimensions inform this model. Its three turns, gate spacing, pavilion proportions and ornamental details remain reconstruction interpretations rather than a complete measured survey.'),
    b('西侧短接道与东侧通往方河的连接为本展览新设。沿原模型盘道可以步行登亭，也可使用扫把从不同高度观察山门与远处的透视布景。','The short western approach and the eastern connection toward Fanghe are new exhibition paths. Follow the model’s winding path on foot, or use the broom to compare the gateways and distant perspective screens from different heights.'),
  ],['xianfashan'],['fanghe-xianfahua','western-palaces']),
  entry('fanghe-xianfahua','changchunyuan','landscape',b('方河与线法画','Fanghe and the perspective screens'),b('水面之后，是一场关于透视的实验。','Beyond the water lies an experiment in perspective.'),[
    b('逐级收口的布景墙营造出向远处延伸的视觉效果。它们是与观看位置相关的透视布景，不是一座真正完整的欧洲城镇。','Successively narrowing scenic walls created an illusion of depth. These were perspective constructions tied to a viewing position, rather than a complete European town.'),
  ],['geometry'],['xianfashan','historic-views']),
  entry('formal-gardens','changchunyuan','landscape',b('花坛与层剪圆柏','Parterres and tiered cypresses'),b('植物也是几何设计的一部分。','Planting was part of the geometry.'),[
    b('靠近楼与喷泉的花坛强调边界、轴线和对称。修剪成层的圆柏、花木与铺地共同组织空间，外围的自然种植则带来不同节奏。','Beds near the buildings and fountains emphasized edges, axes and symmetry. Tiered cypresses, flowers and paving organized the space, while more natural planting introduced another rhythm beyond.'),
  ],['geometry','materials'],['western-palaces','huanghuazhen'],[],northCourtExhibitionNote),
  entry('qichunyuan','qichunyuan','landscape',b('绮春园','Qichunyuan'),b('多处小园逐步相接，形成不同于宫廷轴线的园居节奏。','Smaller gardens joined over time to form a different rhythm of garden life.'),[
    b('湖岛、桥与院落构成相连的游览空间。研究绮春园时，需要分别辨认毁前格局、毁后遗存与后来的修复或重修计划。','Islands, bridges and courts formed connected spaces for garden life. Its pre-destruction arrangement must be distinguished from surviving remains and later repairs or rebuilding schemes.'),
    b('1874 年的三园地盘河道全图属于同治重修计划的资料。它对理解三园关系很有价值，却不能全部当作 1860 年已建成的样貌。','The three-garden waterway plan of 1874 belongs to the Tongzhi rebuilding project. It is valuable for understanding relationships between the gardens, but cannot be treated wholesale as the built state in 1860.'),
  ],['threeGardens','gardenPlan'],['three-gardens','waterways']),
];
for(const item of museumEntries)item.images=[...new Set([...item.images,...(supplementalEntryImages[item.id]||[])])];
const entriesById=new Map(museumEntries.map(value=>[value.id,value]));
export function museumEntry(id){return typeof id==='string'?entriesById.get(id)||null:null;}
export function searchMuseumEntries(query='',region='all'){
  const words=String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return museumEntries.filter(value=>(region==='all'||value.region===region)&&words.every(word=>[value.title.zh,value.title.en,value.lead.zh,value.lead.en,...value.paragraphs.flatMap(p=>[p.zh,p.en])].join(' ').toLocaleLowerCase().includes(word)));
}
export function guideSign(id){
  const value=museumEntry(id);if(!value)return null;
  const text=value.sign||value.lead;
  return {zh:`${value.title.zh} · ${text.zh}`,en:`${value.title.en} · ${text.en}`};
}
