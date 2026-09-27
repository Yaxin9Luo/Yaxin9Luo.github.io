export const ERGONGMEN_ID='ergongmen-xianfeng-study-r1';
const freeze=Object.freeze;
export const ergongmenLayout=freeze({
 id:ERGONGMEN_ID,coordinates:freeze({up:'+Y',north:'-Z',east:'+X'}),
 historicalState:'Xianfeng / immediately before 1860; five open front bays',
 source:freeze({publication:'He Yan, Zijincheng 2011.06, p35; official corrected p49 figure12',authority:'Scholarly reconstruction from Yangshi Lei records and archaeological comparison; not a complete original measured plan held here',chiMetres:.32}),
 grid:freeze({bayWidths:freeze([3.52,3.52,4.16,3.52,3.52]),width:18.24,depth:7.36,frontDepth:5.12,rearCorridorDepth:2.24,frontZ:3.68,innerZ:-1.44,rearZ:-3.68}),
 platform:freeze({width:19.648,depth:8.768,height:.704,columnAxisMargin:.704,groundBrick:freeze([.215,.44])}),
 columns:freeze({woodHeight:3.84,eavesDiameter:.32,innerDiameter:.352,baseHeight:.16,baseSquare:.67,baseTopDiameter:.50,baseHeightAuthority:'inferred; square and round diameters are comparative excavated examples'}),
 roof:freeze({type:'eight-purlin-juanpeng-xieshan-with-rear-inner-corridor',dougong:false,width:20.96,depth:9.52,eaveY:5.171,rise:1.80,coverOuterDiameter:.1216,tilePitch:.2432,courseLength:.44,purlinZ:freeze([-3.68,-2.56,-1.44,-.32,.32,1.44,2.56,3.68]),purlinDiameter:.19,rafterRadius:.035,
  authority:'Eight purlins / 1.12m slope step / No.2 cover diameter from p35; .64m central paired-purlin spacing derives from 7.36m grid. Roof overhang, curve, roll spacing, structural sections, lap and tile length are interpreted.'}),
 doors:freeze({bays:freeze([1,2,3]),pairs:3,z:-1.44,leafHeight:2.94,openingDegrees:82,openingAuthority:'Open display pose is authored, not a historical operating-state claim'}),
 stairs:freeze({bays:freeze([1,2,3]),frontAndRear:true,risers:4,run:1.36,authority:'Stair type is late-state evidence; four risers and tread/run are interpreted'}),
 interpretation:freeze(['Column base height and detailed profile','Roof curve, eave projection, purlin/beam/rafter sections and exact joinery','Tiger-skin rubble block positions and mortar joints','Sparrow-brace and gable scroll carving; painted ornament is an authored comparison','Door opening pose, stair count and rail details']),
 excluded:freeze(['Dagongmen and distant screen','Service ranges, crescent channel and Zhengda Guangming Hall','Early Qianlong front windows and bay partitions','Dougong','Unmeasured historical site placement'])
});
export function ergongmenColumnXs(){let x=-ergongmenLayout.grid.width/2;return [x,...ergongmenLayout.grid.bayWidths.map(w=>(x+=w))];}
export function ergongmenBayCenters(){const xs=ergongmenColumnXs();return ergongmenLayout.grid.bayWidths.map((w,i)=>xs[i]+w/2);}
