export const ZHENGDA_GUANGMING_ID='zhengda-guangming-pre1860-study-r1';
const freeze=Object.freeze;
export const zhengdaGuangmingLayout=freeze({
 id:ZHENGDA_GUANGMING_ID,chiMetres:.32,
 historicalState:"Pre-1860 Daoguang-Xianfeng layout; Figure 5 attribution is Liu Dunzhen's conjecture",
 coordinates:freeze({up:'+Y',north:'-Z',east:'+X'}),
 grid:freeze({bayWidths:freeze([4.416,4.416,4.864,5.216,4.864,4.416,4.416]),width:32.608,reportedDepth:12.16,frontGoldZ:6.08,rearGoldZ:-6.08,corridorDepth:1.80,eaveX:18.104,frontEaveZ:7.88,rearEaveZ:-7.88,depthInterpretation:'reported 38 chi assigned to inner-column working span; original endpoints unresolved'}),
 platform:freeze({width:38.40,depth:17.68,height:1.28}),
 moonPlatform:freeze({width:39.04,depth:13.44,height:1.28,rearZ:8.84,frontZ:22.28,authority:'Park institutional article: 122 x 42 chi, about 4 chi high; date unestablished'}),
 columns:freeze({eaveWoodHeight:5.12,innerWoodHeight:5.70,eaveDiameter:.48,innerDiameter:.54,baseHeight:.24,baseSquare:.84,diameterAuthority:'authored comparison, not Fig5 dimensional evidence'}),
 roof:freeze({type:'single-eave-juanpeng-xieshan',width:39.208,depth:19.36,eaveY:7.80,rise:3.00,coverOuterDiameter:.166,tilePitch:.278,courseLength:.50,purlinZ:freeze([-7.88,-6.08,-4.20,-2.25,-.60,.60,2.25,4.20,6.08,7.88]),purlinDiameter:.28,rafterRadius:.043,authority:'profile, tile size and framing authored; ten purlin lines comparative Tongzhi choice, not pre1860 measured complete frame'}),
 doors:freeze({southBays:freeze([0,1,2,3,4,5,6]),northBays:freeze([2,3,4]),leavesPerBay:4,height:4.30,threshold:.09,openCentralLeaves:true,lattice:'authored step-brocade timber lattice; exact historic pattern not recovered'}),
 burner:freeze({count:4,xs:freeze([-13.35,-4.45,4.45,13.35]),z:19.25,baseHeight:.58,totalHeight:2.60,type:'authored bronze tripod censer, paired ears and openwork cover',typeHistoricallyVerified:false}),
 evidence:freeze({numeric:'Liu Dunzhen 1933 printed129 bracketed Fig5 dimensions; 0.32m work chi',topology:'He Yan DPM2011 p29 and corrected49 figure12',accuracy:'research reconstruction with explicitly inferred members, not a recovered survey'})
});
export function zhengdaColumnXs(){let x=-zhengdaGuangmingLayout.grid.width/2;return[x,...zhengdaGuangmingLayout.grid.bayWidths.map(w=>(x+=w))];}
export function zhengdaBayCenters(){const xs=zhengdaColumnXs();return zhengdaGuangmingLayout.grid.bayWidths.map((w,i)=>xs[i]+w/2);}
