// Terrain/navigation input, not a surveyed reconstruction or a completed model.
// Rings are open arrays of [x,z], with positive shoelace area. Positions are [x,y,z].
// No Three.js, DOM, asset loader, random generation or factory dependency belongs here.
const GROUND_Y=4,WATER_Y=2;
const PLAN='public-three-garden-diagram';
const pixelOrigin=[600,430],unitsPerPixel=2.2;
const px=([u,v],y=GROUND_Y)=>[(u-pixelOrigin[0])*unitsPerPixel,y,(v-pixelOrigin[1])*unitsPerPixel];
const xz=([x,,z])=>[x,z];
const area=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
const positive=ring=>area(ring)<0?[...ring].reverse():ring;
const outline=points=>positive(points.map(p=>xz(px(p))));
const trace=points=>({sourceId:PLAN,method:'manual-generalized-outline',pixels:points});

const sources={
  [PLAN]:{title:'Public three-garden plan, uploaded by Kallgan in 2005',url:'https://commons.wikimedia.org/wiki/File:Yuanmingyuan_plan.jpg',imageUrl:'https://upload.wikimedia.org/wikipedia/commons/6/66/Yuanmingyuan_plan.jpg',reviewFile:'/tmp/commons-yuanmingyuan-plan-layout-review.jpg',pixels:[1200,886],sha256:'78b642f7c707aafd8ee12849f91112094cb5929f2cb0d951d955a406ac964495',date:'original date and author unestablished; upload is not creation date',north:'visible north arrow, approximately image up',evidence:'undated-public-diagram',useForCoordinates:true,limit:'Coarse water/land and wall proportions only. No original survey, georeferencing or 1860 as-built identity established; not distributed as an exhibit image.'},
  'mit-main-garden':{title:'MIT forty-scene navigation map of Yuanmingyuan proper',url:'https://visualizingcultures.mit.edu/garden_perfect_brightness/ymy1_essay02.html',imageUrl:'https://visualizingcultures.mit.edu/garden_perfect_brightness/image/map.gif',file:'work/yuanmingyuan/references/measured-layout/mit-map.gif',pixels:[622,487],evidence:'modern-navigation-diagram',useForCoordinates:false,limit:'Cross-check only: Houhu, Fuhai, islands and relative scene locations; not a three-garden or 1860 survey.'},
  'mit-three-gardens':{title:'MIT separated oblique view of the three gardens',url:'https://visualizingcultures.mit.edu/garden_perfect_brightness/image/ymy_map3.gif',file:'work/yuanmingyuan/references/measured-layout/mit-ymy_map3.gif',pixels:[622,304],evidence:'oblique-context-diagram',useForCoordinates:false,limit:'West/east/southeast relationship only; display gaps and perspective are not ground distances.'},
  'sample-1704':{title:'Palace Museum study reproduction of sample 1704',url:'https://www.dpm.org.cn/Uploads/File/pdf/a9/a0/4c/a9a04c0094d3656bf946c42dd1a2375e.pdf',secondPageUrl:'https://www.dpm.org.cn/Uploads/File/pdf/85/62/3f/85623fa2f29519cda9e6ec9a94d77b47.pdf',files:['work/yuanmingyuan/references/archives-layout/palace-plan-1704-study-map-page-view.png','work/yuanmingyuan/references/archives-layout/palace-plan-1704-study-map-right-page-view.png'],evidence:'historic-plan-reproduced-in-research',useForCoordinates:false,limit:'Qianlong base with later alterations through 1831; checked Houhu/Fuhai forms, not registered or flattened across the page seam.'},
  'sample-1203':{title:'Sample 1203 date discussed in Palace Museum research',url:'https://www.dpm.org.cn/Uploads/File/2018/06/01/u5b112236babf8.pdf',file:'work/yuanmingyuan/references/archives-layout/palace-wanfang-anhe-2016.pdf',evidence:'historical-date-research',useForCoordinates:false,limit:'1859–1860 time anchor; complete readable original still unavailable.'},
  'sample-2517':{title:'Sample 2517, 1874 Tongzhi rebuilding plan',url:'https://www.dpm.org.cn/explode/others/203786.html',detailUrl:'https://www.dpm.org.cn/Uploads/pdf/1574/T00094_00.pdf',dateUrl:'https://www.dpm.org.cn/Uploads/pdf/1574/T00096_00.pdf',file:'work/yuanmingyuan/references/archives-layout/palace-three-gardens-1991-p94.pdf',evidence:'1874-rebuilding-plan',usableAs1860AsBuilt:false,useForCoordinates:false,limit:'Only a fragment and accompanying article were inspected; planned names/buildings are not promoted to 1860 built state.'},
  'durand-1988':{title:'Antoine Durand, restitution after the 1985 survey, Fig. 4 and pp. 123–133',url:'https://www.persee.fr/doc/arasi_0004-3958_1988_num_43_1_1240',files:['work/yuanmingyuan/references/durand-1988/page-126.jpg','work/yuanmingyuan/references/measured-layout/durand-page-127.jpg'],imageUrls:['https://www.persee.fr/renderPage/arasi_0004-3958_1988_num_43_1_1240/arasi_0004-3958_1988_num_43_1_T1_0126_0000_710.jpg','https://www.persee.fr/renderPage/arasi_0004-3958_1988_num_43_1_1240/arasi_0004-3958_1988_num_43_1_T1_0127_0000_710.jpg'],pixelsPerPage:[710,910],evidence:'reported-survey-and-restitution',limit:'Local reported dimensions only. Small two-page reproduction, uncertain eastern limits, hypothetical roofs and inferred pedestal positions; no global control network.'},
  'water-research':{title:'Park water resources study',url:'https://www.yuanmingyuanpark.cn/xs/ktsb/202005/t20200506_4402578.html',evidence:'institutional-research',limit:'Supports connected systems and different depths/uses, not the authored channel centerlines or vertical datum.'},
  'archive-layout-research':{title:'Three-garden archive research and scene relations',url:'https://www.dpm.org.cn/Uploads/pdf/1574/T00095_00.pdf',file:'docs/art/yuanmingyuan/research/archives-layout.md',evidence:'named-archive-research',limit:'Relative names and scene relations; dates and planned alterations must remain separate.'},
  'western-topology':{title:'Western Palace institution and archive source register',url:'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html',file:'docs/art/yuanmingyuan/research/western-buildings.md',evidence:'research-synthesis',limit:'West-to-east groups and opposing views, not a shared measured coordinate frame.'},
  'hanjingtang-research':{title:'Hanjingtang site display research',url:'https://www.yuanmingyuanpark.cn/ymyyj/yj020/201012/t20101226_229503.html',evidence:'named-institutional-research',limit:'North-south axis, south-facing buildings and central main island; stated site dimensions are not used to calibrate the global diagram.'},
  'haiyue-institution':{title:'Haiyue Kaijin',url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231497.html',evidence:'institutional-description',limit:'Circular island north of Siyongzhai, four docks; does not justify an invented land bridge.'},
  'zhengjuesi-institution':{title:'Zhengjuesi',url:'https://www.yuanmingyuanpark.cn/cgll/zyjd/qcy/201101/t20110105_231479.html',evidence:'institutional-description',limit:'South-middle, west of Qichunyuan main gate, separate southern entrance and outside the garden wall; coordinate remains authored.'},
  'qichun-bridge-research':{title:'Park protection and display research',url:'https://www.yuanmingyuanpark.cn/ymyyj/yj020/201012/t20101226_229505.html',evidence:'institutional-research',limit:'Fuchuntang west-gate arch bridge and other surviving crossings; exact bridge spans and coordinates are unregistered.'},
  'exhibition-design':{title:'Contemporary island and visitor layout',file:'docs/art/yuanmingyuan/DESIGN.md',evidence:'exhibition-design',limit:'Open sea, coastline, arrival and working heights are modern website design.'},
};

function garden(id,label,points){return {id,label,boundary:outline(points),groundY:GROUND_Y,wallTopY:6.6,wallHeightEvidence:'author-proportional',boundaryEvidence:'author-proportional',sourceIds:[PLAN,'mit-three-gardens','sample-1203'],trace:trace(points)};}
const gardens=[
  garden('yuanmingyuan','圆明园本园',[[50,100],[257,86],[441,70],[452,62],[462,68],[755,45],[764,122],[771,211],[789,444],[519,465],[531,586],[391,605],[391,653],[360,671],[328,648],[325,610],[96,622],[83,437],[66,270]]),
  garden('changchunyuan','长春园',[[755,45],[800,44],[809,111],[901,108],[903,100],[957,98],[963,111],[1127,99],[1133,206],[1145,211],[1141,270],[1152,286],[1144,300],[1150,444],[1140,458],[1080,467],[1077,532],[1020,539],[972,535],[969,465],[956,463],[944,444],[789,444],[771,211],[764,122]]),
  garden('qichunyuan','绮春园',[[942,446],[957,470],[962,548],[973,623],[991,667],[1019,683],[1023,721],[931,746],[847,775],[836,746],[795,746],[804,783],[719,836],[607,844],[599,713],[535,712],[540,675],[550,670],[549,612],[571,600],[576,572],[673,561],[678,493],[714,490],[718,467],[801,460],[850,449]]),
];

function lake(id,label,regionId,points,depth=2){return {id,label,regionId,kind:'lake',polygon:outline(points),surfaceY:WATER_Y,bedY:WATER_Y-depth,depthEvidence:'author-proportional',sourceIds:[PLAN,'water-research'],trace:trace(points)};}
const waterBodies=[
  lake('houhu','后湖与九洲环岛水道','yuanmingyuan',[[213,372],[238,355],[259,354],[283,345],[311,355],[336,345],[355,353],[382,345],[411,362],[430,385],[442,418],[439,464],[449,493],[433,518],[411,529],[360,537],[321,533],[282,529],[250,519],[226,500],[217,465],[225,436],[211,408]],2),
  lake('qianhu','前湖','yuanmingyuan',[[310,533],[340,537],[380,535],[388,546],[387,560],[362,565],[333,563],[323,554],[313,551]],1.8),
  lake('fuhai','福海','yuanmingyuan',[[550,212],[572,193],[598,182],[631,177],[659,181],[687,168],[711,177],[732,194],[742,218],[744,244],[751,261],[751,289],[748,307],[756,326],[753,351],[746,380],[728,401],[703,411],[680,418],[650,418],[622,425],[598,420],[577,424],[553,416],[539,402],[533,377],[536,352],[529,330],[534,309],[530,286],[538,263],[534,243],[542,226]],2.3),
  lake('west-long-lake','西路长水面','yuanmingyuan',[[126,429],[143,417],[159,429],[174,425],[193,434],[195,465],[209,483],[208,509],[196,523],[199,552],[185,576],[168,594],[145,590],[135,570],[134,542],[129,518],[128,489],[119,462]],1.3),
  lake('wanfang-lake','万方安和水院','yuanmingyuan',[[214,298],[235,289],[269,310],[279,342],[261,365],[229,365],[211,349],[216,330]],1.3),
  lake('northwest-garden-lake','西北园中园水面','yuanmingyuan',[[82,158],[125,150],[152,158],[158,187],[183,194],[205,182],[224,192],[219,228],[208,250],[186,276],[169,290],[149,296],[128,287],[115,269],[90,243],[79,211]],1.4),
  lake('north-garden-water','北路农桑河渠','yuanmingyuan',[[151,133],[198,125],[239,128],[263,123],[313,124],[365,118],[402,123],[444,112],[489,118],[525,109],[571,105],[609,94],[651,99],[683,91],[721,91],[744,100],[742,112],[717,116],[687,111],[653,118],[614,115],[574,124],[531,128],[495,134],[452,129],[412,139],[370,133],[315,141],[264,138],[236,142],[201,139],[162,145]],1),
  lake('changchun-great-lake','长春园大湖与中央岛水道','changchunyuan',[[820,204],[838,191],[866,184],[880,189],[894,210],[918,192],[951,181],[979,180],[1007,173],[1022,190],[1025,222],[1035,247],[1060,259],[1090,253],[1105,229],[1116,205],[1118,174],[1127,170],[1129,198],[1122,231],[1112,259],[1103,283],[1106,318],[1110,340],[1103,371],[1111,394],[1130,408],[1128,427],[1096,442],[1040,429],[996,427],[974,438],[953,435],[951,419],[914,425],[871,440],[832,433],[817,419],[816,389],[828,365],[826,344],[815,328],[808,304],[810,265],[814,235]],1.8),
  lake('qichun-northeast-lake','绮春东北湖群','qichunyuan',[[739,484],[767,477],[793,478],[824,464],[845,464],[866,474],[877,495],[898,484],[923,481],[940,492],[944,528],[951,554],[941,578],[918,584],[895,578],[877,565],[851,567],[836,592],[810,598],[792,590],[779,582],[754,584],[742,561],[730,555],[728,530]],1.4),
  lake('qichun-west-lake','绮春西路水院','qichunyuan',[[552,626],[575,615],[608,614],[638,621],[657,634],[654,657],[638,676],[609,683],[583,675],[560,682],[549,674]],1.2),
  lake('qichun-southwest-lake','绮春西南湖','qichunyuan',[[685,657],[705,644],[729,641],[758,646],[782,639],[795,653],[797,673],[786,693],[772,714],[768,739],[746,776],[726,792],[701,807],[680,809],[670,795],[679,772],[685,749],[675,723],[679,700]],1.4),
  lake('qichun-central-lake','鉴碧亭与宫门西侧湖','qichunyuan',[[805,625],[821,616],[844,622],[857,641],[868,662],[876,680],[884,700],[874,722],[854,730],[829,731],[817,718],[811,695],[798,677],[795,653]],1.3),
];

const ornamentalWaters=[{...lake('fanghe','方河 · 线法画前水面','changchunyuan',[[1034,115],[1046,114],[1092,114],[1104,116],[1104,129],[1094,132],[1046,132],[1034,130]],1.3),kind:'ornamental-basin',hydraulicConnection:'unregistered',sourceIds:[PLAN,'durand-1988','western-topology'],limit:'The near-rectangular basin west of the scenic walls is retained. Its supply/outlet and exact eastern parcel limits are unknown; no surface canal is invented.'}];

function island(id,label,waterId,anchor,points){return {id,label,waterId,polygon:outline(points),anchor:px(anchor),heightY:GROUND_Y,evidence:'author-proportional',sourceIds:[PLAN,'archive-layout-research'],trace:trace(points)};}
const islands=[
  island('jiuzhou-qingyan-island','九洲清晏洲','houhu',[350,507],[[304,490],[327,490],[345,494],[384,490],[399,498],[407,508],[396,521],[370,524],[340,522],[312,522],[298,512]]),
  island('jiuzhou-southeast-island','东南洲 · 镂月开云一带','houhu',[426,502],[[413,487],[432,486],[440,499],[433,513],[421,520],[410,510]]),
  island('jiuzhou-east-island','东洲 · 天然图画一带','houhu',[417,445],[[401,422],[418,420],[434,434],[432,459],[421,470],[406,463],[401,446]]),
  island('jiuzhou-northeast-island','东北洲 · 碧桐书院一带','houhu',[399,389],[[385,368],[404,371],[418,385],[412,407],[396,411],[383,399],[381,385]]),
  island('jiuzhou-north-temple-island','北洲 · 慈云普护一带','houhu',[361,378],[[341,360],[357,356],[374,365],[379,382],[375,399],[357,404],[347,393]]),
  island('jiuzhou-northwest-island','西北洲 · 上下天光一带','houhu',[323,382],[[309,362],[329,362],[338,376],[338,397],[323,410],[307,399],[304,378]]),
  island('jiuzhou-xinghua-island','杏花春馆洲','houhu',[279,387],[[262,369],[282,361],[299,370],[300,388],[290,404],[273,411],[255,398],[256,382]]),
  island('jiuzhou-tantan-island','坦坦荡荡洲','houhu',[258,441],[[239,422],[260,418],[278,429],[282,448],[270,462],[246,461],[233,446]]),
  island('jiuzhou-rugu-island','茹古涵今洲','houhu',[272,493],[[254,478],[276,473],[292,484],[292,503],[282,516],[260,514],[245,502]]),
  island('pengdao-west','蓬岛西岛','fuhai',[615,288],[[608,285],[613,281],[620,284],[621,289],[617,294],[610,292]]),
  island('pengdao-main','蓬岛瑶台主岛','fuhai',[638,301],[[628,294],[635,290],[644,294],[649,302],[644,310],[632,311],[627,304]]),
  island('pengdao-east','蓬岛东岛','fuhai',[659,300],[[653,296],[659,293],[666,296],[668,303],[661,307],[655,305]]),
  island('wanfang-island','万方安和水上基址','wanfang-lake',[236,335],[[229,320],[241,319],[245,330],[256,333],[255,345],[242,349],[232,343],[222,345],[219,333]]),
  island('anyou-island','安佑宫水环台地','northwest-garden-lake',[114,191],[[91,167],[134,165],[148,181],[148,218],[136,236],[109,237],[93,216]]),
  island('haiyue-island','海岳开襟圆岛','changchun-great-lake',[850,270],[[832,270],[835,260],[842,253],[850,251],[860,255],[867,263],[869,271],[865,281],[857,287],[848,289],[839,284],[833,278]]),
  island('hanjingtang-main-island','含经堂主岛','changchun-great-lake',[958,306],[[929,264],[959,257],[982,264],[986,280],[983,311],[992,335],[996,365],[978,384],[954,387],[929,374],[921,350],[911,335],[909,308],[920,289]]),
  island('changchun-east-island','玉玲珑馆等东部水院','changchun-great-lake',[1052,331],[[1030,286],[1057,290],[1075,308],[1072,341],[1087,347],[1090,372],[1070,380],[1054,369],[1032,365],[1018,339],[1019,314]]),
  island('siyong-island','思永斋水院','changchun-great-lake',[857,372],[[837,347],[867,347],[885,360],[881,380],[866,396],[841,391],[832,371]]),
  island('qichun-fenglin-island','凤麟洲位置研究岛','qichun-northeast-lake',[780,550],[[758,540],[772,536],[789,539],[798,550],[789,567],[773,571],[758,562]]),
  island('qichun-northeast-island','绮春东北小岛','qichun-northeast-lake',[916,520],[[905,516],[913,510],[924,513],[927,521],[916,527],[906,522]]),
  island('qichun-southwest-island','绮春西南水心岛','qichun-southwest-lake',[713,747],[[697,740],[707,731],[718,734],[729,745],[723,758],[708,761],[697,751]]),
  island('jianbi-island','鉴碧亭位置研究岛','qichun-central-lake',[849,681],[[843,674],[853,674],[857,682],[851,688],[843,685]]),
];

// Authored channel corridors use averaged segment directions at bends.
function corridor(points,width){
  const half=width/2,left=[],right=[];
  for(let i=0;i<points.length;i++){
    const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
    const dx=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dx,dz),normal=[-dz/length,dx/length];
    left.push([points[i][0]+normal[0]*half,points[i][1]+normal[1]*half]);right.push([points[i][0]-normal[0]*half,points[i][1]-normal[1]*half]);
  }
  return positive([...left,...right.reverse()]);
}
function channel(id,fromWaterId,toWaterId,points,width=12,kind='open-channel'){
  const centerline=points.map(p=>xz(px(p)));
  return {id,fromWaterId,toWaterId,centerline,width,polygon:corridor(centerline,width),surfaceY:WATER_Y,bedY:.6,kind,evidence:'author-proportional',sourceIds:[PLAN,'water-research'],trace:trace(points),limit:'Connected hydraulic relationship is supported; this exact route, width, flow direction and height are authored. No historical discharge or sluice survey.'};
}
const channels=[
  channel('houhu-fuhai-link','fuhai','houhu',[[545,365],[513,360],[500,394],[475,407],[451,402],[431,402]],14),
  channel('qianhu-east-loop','houhu','qianhu',[[445,492],[449,523],[435,550],[381,550]],11),
  channel('jiuzhou-west-loop','houhu','wanfang-lake',[[226,395],[209,389],[202,365],[213,354],[224,350]],10),
  channel('western-waterway','wanfang-lake','west-long-lake',[[218,338],[204,343],[191,370],[191,403],[178,438]],12),
  channel('northwest-waterway','wanfang-lake','northwest-garden-lake',[[235,302],[215,291],[201,274],[188,266]],11),
  channel('north-rural-inlet','northwest-garden-lake','north-garden-water',[[165,197],[181,165],[205,143],[208,132]],10),
  channel('north-fuhai-waterway','north-garden-water','fuhai',[[720,105],[749,124],[757,159],[740,198],[728,217]],12),
  channel('main-changchun-transfer','fuhai','changchun-great-lake',[[740,305],[769,310],[790,304],[815,300]],10,'wall-culvert-route'),
  channel('three-garden-water-junction','fuhai','qichun-northeast-lake',[[693,409],[715,430],[730,458],[755,490]],12,'wall-culvert-route'),
  channel('qichun-west-link','qichun-northeast-lake','qichun-west-lake',[[745,556],[717,568],[682,586],[667,610],[647,639]],12),
  channel('qichun-southwest-link','qichun-northeast-lake','qichun-southwest-lake',[[786,577],[780,608],[752,628],[740,654]],12),
  channel('qichun-central-link','qichun-northeast-lake','qichun-central-lake',[[839,577],[817,610],[829,637]],11),
  channel('qichun-south-cross-link','qichun-central-lake','qichun-southwest-lake',[[810,665],[791,678],[776,685]],10),
  channel('fuchun-west-stream','qichun-northeast-lake','qichun-central-lake',[[890,563],[884,598],[883,642],[876,699]],12),
];

function bridge(id,label,a,b,sourceIds=['archive-layout-research',PLAN]){
  const from=px(a,4.5),to=px(b,4.5),position=from.map((v,i)=>(v+to[i])/2),width=5;
  return {id,label,from,to,position,width,deckY:4.5,polygon:corridor([xz(from),xz(to)],width),evidence:'author-proportional',sourceIds,limit:'Crossing selected for layout continuity; span, deck height, parapet and exact historic bridge identity require registration.'};
}
const bridges=[
  bridge('qingyan-east-bridge','九洲清晏东接桥',[399,508],[415,508]),
  bridge('qingyan-west-bridge','九洲清晏西接桥',[302,507],[288,499]),
  bridge('jiuzhou-west-bridge','九洲西岸接桥',[208,443],[245,442]),
  bridge('jiuzhou-east-bridge','九洲东岸接桥',[429,448],[453,449]),
  bridge('pengdao-west-bridge','蓬岛西岛桥',[619,288],[629,297]),
  bridge('pengdao-east-bridge','蓬岛东岛桥',[647,302],[655,301]),
  bridge('hanjingtang-east-bridge','含经堂东水院接桥',[986,330],[1023,330],['hanjingtang-research',PLAN]),
  bridge('fuchun-west-bridge','敷春堂西侧跨溪桥',[874,632],[892,632],['qichun-bridge-research',PLAN]),
  bridge('qichun-west-approach','绮春西路接桥',[654,608],[680,621],['qichun-bridge-research',PLAN]),
];

function landform(id,label,center,points,peakY,sourceIds=[PLAN]){return {id,label,center:px(center),polygon:outline(points),baseY:GROUND_Y,peakY,heightMode:'smooth-mound',heightEvidence:'author-proportional',sourceIds,trace:trace(points)};}
const landforms=[
  landform('western-long-ridge','西园狭长山冈',[109,390],[[95,300],[109,302],[118,331],[113,367],[121,399],[119,425],[109,452],[102,432],[103,395],[94,363]],9),
  landform('wuling-ridge','武陵春色山水分隔',[286,294],[[273,271],[290,267],[306,281],[309,301],[298,313],[282,311],[270,290]],8),
  landform('fuhai-north-ridge','福海北岸山冈',[642,155],[[558,143],[592,133],[624,140],[649,130],[675,138],[694,153],[687,165],[660,163],[637,169],[609,158],[579,166],[556,159]],9),
  landform('fuhai-south-ridge','福海南岸叠山',[640,444],[[553,431],[581,435],[612,430],[642,434],[673,431],[702,424],[725,429],[710,443],[681,451],[645,454],[612,449],[577,450],[553,443]],8),
  landform('changchun-east-ridge','长春园东岸丘冈',[1122,334],[[1115,284],[1128,282],[1136,305],[1133,330],[1140,354],[1136,383],[1125,394],[1116,379],[1119,354],[1112,330]],8),
  landform('qichun-west-ridge','绮春西南园中园山冈',[653,747],[[642,690],[653,700],[659,723],[659,749],[668,772],[665,800],[652,814],[642,797],[646,774],[638,747],[642,720]],8),
  landform('qichun-central-ridge','绮春中央曲折山冈',[789,615],[[773,590],[787,582],[799,595],[802,616],[790,631],[779,633],[766,620]],7),
  {...landform('xianfa-hill','线法山人工丘',[1020,139],[[1006,138],[1008,128],[1019,123],[1030,128],[1035,140],[1030,149],[1020,154],[1009,149]],12,['western-topology',PLAN]),relativeHeight:8,heightEvidence:'institution-reported-approximation; authored footprint and datum',assetTerrainPolicy:'use this mound until an asset owns the complete hill; do not stack both terrains'},
];

const westernOrigin=[770,GROUND_Y,-640];
const westernPosition=([x,z])=>[westernOrigin[0]+x,GROUND_Y,westernOrigin[2]+z];
function group(id,label,regionId,point,members,{heightHint=18,museumEntryId=null,sourceIds=['archive-layout-research',PLAN],facing='south',wallRelation='inside',assetId=null,rotationY=0,local=null,limit='Named main group; exact footprints, levels and sub-building positions remain unregistered.'}={}){
  return {id,label,regionId,position:local?westernPosition(local):px(point),heightHint,heightEvidence:'author-proportional',members,museumEntryId,status:'layout-planned',timeLayer:'1859-1860-target',wallRelation,facing,assetId,placement:{evidence:'author-proportional',rotationY,scale:1,sourceFront:assetId?'+Z':null,anchor:assetId?'factory-origin':'group-centre',groundDatumY:GROUND_Y,sourcePixel:local?null:point,localFrame:local?'westernPalaces':null,localXZ:local,limit},sourceIds};
}
const groups=[
  group('imperial-court','大宫门、正大光明与勤政亲贤','yuanmingyuan',[358,585],['dagongmen','zhengdaguangming','qinzhengqinxian'],{heightHint:18}),
  group('jiuzhou-qingyan','九洲清晏','yuanmingyuan',[350,507],['yuanmingyuan-hall','fengsanwusi','jiuzhou-qingyan'],{museumEntryId:'jiuzhou'}),
  group('jiuzhou-east','九洲东部水院','yuanmingyuan',[417,445],['louyue-kaiyun','tianran-tuhua','bitong-shuyuan'],{museumEntryId:'jiuzhou',heightHint:14}),
  group('jiuzhou-north','九洲北部水院','yuanmingyuan',[323,382],['ciyun-puhu','shangxia-tianguang'],{museumEntryId:'jiuzhou',heightHint:15}),
  group('jiuzhou-west','九洲西部园居','yuanmingyuan',[258,441],['xinghua-chunguan','tantan-dangdang','rugu-hanjin'],{museumEntryId:'jiuzhou',heightHint:12}),
  group('changchun-xianguan','长春仙馆','yuanmingyuan',[284,558],['changchun-xianguan','western-court-galleries'],{heightHint:12}),
  group('wanfang-anhe','万方安和','yuanmingyuan',[236,335],['wanfang-anhe'],{heightHint:10}),
  group('wuling-chunse','武陵春色与西路园中园','yuanmingyuan',[239,287],['wuling-chunse','western-rock-and-water-gardens'],{heightHint:13}),
  group('anyougong-northwest','安佑宫与西北宗教园林','yuanmingyuan',[114,191],['anyougong','ritian-linyu','huifang-shuyuan'],{heightHint:20}),
  group('north-rural-gardens','北路农桑与村居','yuanmingyuan',[580,82],['duojia-ruyun','yuyue-yuanfei','beiyuan-shancun'],{heightHint:10}),
  group('pengdao-yaotai','蓬岛瑶台三岛','yuanmingyuan',[638,301],['pengdao-main','pengdao-west','pengdao-east'],{heightHint:20}),
  group('fanghu-shengjing','方壶胜境','yuanmingyuan',[709,143],['fanghu-shengjing','northeast-lake-terraces'],{heightHint:27}),
  group('fuhai-west-gardens','福海西岸与文化园林','yuanmingyuan',[492,209],['kuoran-dagong','sifang-shuyuan','zuoshi-linliu','quyuan-fenghe'],{heightHint:16,limit:'A production planning bundle along the west shore; the members are not one historical compound and require individual placement later.'}),
  group('hanjingtang','含经堂与淳化轩','changchunyuan',[958,306],['hanjingtang','chunhuaxuan','yunzhenzhai','fanxianglou'],{heightHint:22,sourceIds:['hanjingtang-research',PLAN]}),
  group('haiyue-kaijin','海岳开襟','changchunyuan',[850,270],['haiyue-kaijin','four-landing-stages'],{heightHint:24,sourceIds:['haiyue-institution',PLAN]}),
  group('shizilin','狮子林与东北园中园','changchunyuan',[1084,175],['shizilin-east','shizilin-west','northeastern-garden-chain'],{heightHint:15}),
  group('siyong-qianyuan','思永斋、茜园与南部园林','changchunyuan',[857,372],['siyongzhai','qianyuan','ruyuan','changchun-main-gate'],{heightHint:16,sourceIds:['haiyue-institution','hanjingtang-research',PLAN],limit:'Main southern Chinese garden planning bundle; separate members retain separate footprints and are not copies of this one anchor.'}),
  group('xieqiqu','谐奇趣与两池、独立蓄水楼','changchunyuan',null,['xieqiqu-hall','curved-galleries-and-music-pavilions','south-haitang-pool','north-chrysanthemum-pool','northwest-reservoir'],{local:[-375,75],assetId:'xieqiqu',museumEntryId:'xieqiqu',sourceIds:['western-topology','durand-1988'],heightHint:22}),
  group('huanghuazhen','花园门、黄花阵与中心亭','changchunyuan',null,['garden-gate','huanghuazhen','central-octagonal-pavilion'],{local:[-375,-105],museumEntryId:'huanghuazhen',sourceIds:['western-topology','durand-1988'],heightHint:13}),
  group('yangquelong','养雀笼与东西两门庭','changchunyuan',null,['west-chinese-gate','aviary','east-european-gate'],{local:[-332,0],museumEntryId:'yangquelong',facing:'east-and-west',sourceIds:['western-topology','durand-1988'],heightHint:13}),
  group('fangwaiguan','方外观与左右曲阶','changchunyuan',null,['fangwaiguan','paired-curved-stairs'],{local:[-236,-4],museumEntryId:'fangwaiguan',sourceIds:['western-topology','durand-1988'],heightHint:13}),
  group('wuzhuting','五竹亭、连廊与水庭','changchunyuan',null,['five-bamboo-pavilions','connecting-galleries','water-garden-bridge'],{local:[-236,26],museumEntryId:'wuzhuting',facing:'north',sourceIds:['western-topology','durand-1988'],heightHint:9}),
  group('haiyantang','海晏堂与生肖水法、后部供水台','changchunyuan',null,['west-hall','west-stairs','zodiac-fountain','waterworks','north-and-south-pools'],{local:[-157,0],assetId:'haiyantang',rotationY:-Math.PI/2,museumEntryId:'haiyantang',facing:'west',sourceIds:['western-topology','durand-1988'],heightHint:27,limit:'Factory +Z is historical west. Rotate the whole group -pi/2 around +Y; no factory child should receive a second compass rotation.'}),
  group('yuanyingguan','远瀛观、大水法与观水法','changchunyuan',null,['yuanyingguan','dashuifa','guanshuifa','deer-and-ten-hounds','copper-cranes'],{local:[0,0],assetId:'yuanyingguan',museumEntryId:'yuanyingguan',facing:'south; viewing-throne-north',sourceIds:['western-topology','durand-1988'],heightHint:22,limit:'Factory +Z is south; keep rotationY=0. Hall, fountain and throne stay in one asset-owned north-south frame. Preserve its depressed court; replace underlying terrain within the court instead of burying it under a Y=0 pad.'}),
  group('xianfashan','线法山与东西门、山顶亭','changchunyuan',null,['western-perspective-gate','spiral-hill','summit-pavilion','eastern-perspective-gate'],{local:[155,0],museumEntryId:'xianfashan',facing:'east-and-west',sourceIds:['western-topology','durand-1988'],heightHint:16}),
  group('xianfahua','方河与湖东线法画','changchunyuan',null,['fanghe','perspective-screen-walls'],{local:[370,0],museumEntryId:'fanghe-xianfahua',facing:'west',sourceIds:['western-topology','durand-1988'],heightHint:14,limit:'Anchor is the eastern scenic-wall group. The rectangular basin is west of it; this is not a full European town. The exact eastern enclosure remains unregistered.'}),
  group('qichun-palace-fuchun','绮春宫门与敷春堂院落','qichunyuan',[918,635],['qichun-main-gate','yinghuidian','fuchuntang','qichun-eastern-courts'],{heightHint:17,sourceIds:['qichun-bridge-research','archive-layout-research',PLAN],limit:'Named palace/court planning bundle for the 1859–60 target. Footprints and labels from 1874 rebuilding are not treated as the earlier as-built state.'}),
  group('qichun-fenglinzhou','凤麟洲与东北湖岛','qichunyuan',[780,550],['fenglinzhou','north-lake-islands','hanqiuguan'],{heightHint:12,limit:'Island position is an author-assigned scene anchor within the traced northern lake network; original name-to-island registration remains pending.'}),
  group('qichun-hanhui-west','含晖楼与西路相连小园','qichunyuan',[635,735],['hanhuilou','western-enclosed-gardens','southwest-water-courts'],{heightHint:14,limit:'Regional planning anchor; exact named courtyard correspondence is unresolved and must not be advertised as an excavated footprint.'}),
  group('zhengjuesi','正觉寺','qichunyuan',[815,763],['temple-south-gate','tianwangdian','wenshuting','zuishanglou'],{heightHint:19,museumEntryId:'zhengjuesi',wallRelation:'attached-outside',sourceIds:['zhengjuesi-institution',PLAN],limit:'Attached temple west of the palace gate, with independent southern entrance and rear connection. Its annex sits outside the authored historical garden-wall indentation.'}),
];

const measured=(id,dimensions,locator,limit)=>({id,dimensions,unit:'metre',evidence:'reported-measurement',sourceId:'durand-1988',locator,limit});
const coastPoints=[[20,67],[244,48],[430,26],[453,14],[474,32],[737,9],[827,9],[842,78],[904,65],[969,63],[990,79],[1164,63],[1177,181],[1191,222],[1185,277],[1198,305],[1181,450],[1160,495],[1110,507],[1112,553],[1062,576],[1013,576],[1009,619],[1047,665],[1061,718],[1044,757],[953,785],[860,816],[783,838],[736,874],[586,879],[564,760],[506,754],[498,700],[456,695],[420,712],[379,738],[325,726],[294,681],[282,650],[75,657],[43,535],[35,338]];

export const gardenLayout={
  schemaVersion:1,id:'yuanming-three-gardens-proportional-layout-v1',status:'layout-draft',timeLayer:{id:'1859-1860-target',years:[1859,1860],evidenceSource:'sample-1203',asBuiltComplete:false},
  coordinates:{up:'+Y',east:'+X',south:'+Z',units:'working-unit',nominalMetresPerUnit:1,metresCalibrated:false,ringFormat:'unclosed [x,z], positive shoelace area',positionFormat:'[x,y,z]',verticalDatum:'authored; sea 0, lake 2, ordinary land 4'},
  registration:{status:'unregistered',method:'manual generalization from the stated diagram; no fitted survey transform',rmsResidual:null,controlPoints:[],authorImageTransform:{sourceId:PLAN,pixelOrigin,workingUnitsPerPixel:unitsPerPixel,rotation:0},limit:'The 2.2 working units per pixel is a design scale, not a measured metres-per-pixel result. No perspective flattening or image-gap-to-water conversion.'},
  sources,gardens,waterBodies,ornamentalWaters,islands,channels,bridges,landforms,groups,
  metricFrames:{westernPalaces:{origin:westernOrigin,axes:{east:'+X',south:'+Z'},registration:{status:'author-placement',rotationY:0,scale:1,rmsResidual:null,limit:'Local dimensions and global diagram positions are not geodetically registered.'},controls:[
    measured('western-north-south-arm',[320,85],'p.123','Reported arm extents; starting and ending boundary registration remains unresolved.'),
    measured('eastern-east-west-strip',[770,60],'p.123','Do not add the arm and strip lengths as one exact site extent.'),
    measured('dashuifa-court',[110,60],'p.127, Fig.5','Ground court dimensions, not engraving perspective dimensions.'),
    measured('paired-pools',[18,62],'p.127','First number diameter, second centre spacing; not a rectangle.'),
    measured('court-depression',[1.3],'p.127','Relative level; not the artificial island sea datum.'),
    measured('yuanyingguan-terrace',[35,31],'pp.131–133','Second terrace dimension approximate; distinguish platform from building footprint.'),
    measured('yuanyingguan-footprint',[21,28],'pp.131–133','Dimension axis ordering requires column-grid verification; the author reports approximately 0.50 m accuracy, not our global accuracy.'),
    measured('fangwaiguan',[14,7,13],'p.129','Building dimensions excluding stairs; not the complete asset envelope.'),
  ],axisRelations:[['xieqiqu','yangquelong','fangwaiguan','haiyantang','yuanyingguan','xianfashan','xianfahua']],unresolved:['Aviary/reservoir sides conflict between Durand prose p.123 and Fig.4; retain corroborated west reservoir / east aviary topology.','Exact eastern basin enclosure and original survey point coordinates unavailable.','Local roofs, north hall plan and missing animal pedestals contain reconstruction hypotheses.']}},
  exhibition:{seaY:0,groundY:GROUND_Y,coast:{id:'modern-island-coast',polygon:outline(coastPoints),shoreY:0,evidence:'exhibition-design',sourceIds:['exhibition-design'],limit:'A modern open-sea exhibition envelope, not a Qing coast or the historical garden wall.'},arrival:{id:'modern-arrival',position:px([408,676],1.2),facing:'north',evidence:'exhibition-design',sourceIds:['exhibition-design']},templeAnnex:{id:'zhengjuesi-annex',polygon:outline([[795,744],[833,742],[844,771],[806,787]]),evidence:'author-proportional',sourceIds:['zhengjuesi-institution',PLAN]}},
  limits:['Only principal scene groups are planned; a group list is not a completed garden.','Water polygons deliberately retain open lake space; nine Jiuzhou islands and three Pengdao islands are land exclusions.','All non-reported dimensions, elevations, channels and bridge spans are authored and require source registration.','Water transfer centerlines are connectivity inputs, not proven historic flow paths or an operating hydraulic simulation.','The unmeasured Chinese garden groups need detailed plans before architectural reconstruction.','No source image or heavy model is bundled by this module.'],
};

export function pointInPolygon([x,z],ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],cross=(x-a[0])*(b[1]-a[1])-(z-a[1])*(b[0]-a[0]);
    if(Math.abs(cross)<1e-7&&x>=Math.min(a[0],b[0])-1e-7&&x<=Math.max(a[0],b[0])+1e-7&&z>=Math.min(a[1],b[1])-1e-7&&z<=Math.max(a[1],b[1])+1e-7)return true;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function waterAt(x,z){
  if(islands.some(island=>pointInPolygon([x,z],island.polygon)))return null;
  return waterBodies.find(water=>pointInPolygon([x,z],water.polygon))||ornamentalWaters.find(water=>pointInPolygon([x,z],water.polygon))||channels.find(channel=>pointInPolygon([x,z],channel.polygon))||null;
}
function distanceToRing(point,ring){
  let best=Infinity;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
    const t=length2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length2)):0;
    best=Math.min(best,Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz));
  }
  return best;
}
export function surfaceAt(x,z){
  if(!pointInPolygon([x,z],gardenLayout.exhibition.coast.polygon))return {kind:'sea',height:gardenLayout.exhibition.seaY};
  const bridge=bridges.find(b=>pointInPolygon([x,z],b.polygon));if(bridge)return {kind:'bridge',id:bridge.id,height:bridge.deckY};
  const water=waterAt(x,z);if(water)return {kind:'water',id:water.id,height:water.surfaceY,bedY:water.bedY};
  let height=GROUND_Y;
  for(const hill of landforms)if(pointInPolygon([x,z],hill.polygon)){
    const t=Math.min(1,distanceToRing([x,z],hill.polygon)/Math.max(.01,distanceToRing(xz(hill.center),hill.polygon)));
    height=Math.max(height,hill.baseY+(hill.peakY-hill.baseY)*t*t*(3-2*t));
  }
  return {kind:'land',height};
}
export function getGardenGroup(id){return typeof id==='string'?groups.find(group=>group.id===id)||null:null;}
export function transformAssetPoint(group,[x,y,z]){
  const c=Math.cos(group.placement.rotationY),s=Math.sin(group.placement.rotationY),scale=group.placement.scale;
  return [group.position[0]+(x*c+z*s)*scale,group.position[1]+y*scale,group.position[2]+(-x*s+z*c)*scale];
}
