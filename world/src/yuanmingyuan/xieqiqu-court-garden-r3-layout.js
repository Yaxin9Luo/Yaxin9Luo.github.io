import {createXieqiquCourtGardenR1Layout,roundedCourtGardenRing} from './xieqiqu-court-garden-r1-layout.js';
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const inRing=(x,z,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function edgeDistance(x,z,ring){let best=Infinity;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return best;}
const roots={sedge:.073635,'flower-shrub':.040467,'low-broadleaf':.07579315283474522,juniper:.68};
const PHI=Math.PI*(3-Math.sqrt(5)),fract=x=>x-Math.floor(x),bell=(x,c,w)=>Math.exp(-Math.pow((x-c)/w,2));

function createCourtBandsSpatialFrame(){
 const baseline=createXieqiquCourtGardenR1Layout(),beds=[],placements=[];
 function bed(id,cx,cz,width,depth,radius){
  const record={id,cx,cz,width,depth,radius,
   outer:roundedCourtGardenRing(cx,cz,width,depth,radius),
   inner:roundedCourtGardenRing(cx,cz,width-.26,depth-.26,radius-.13),
   apron:roundedCourtGardenRing(cx,cz,width+.50,depth+.50,radius+.25),mineralPatches:[]};
  beds.push(record);return record;
 }
 for(const side of [-1,1]){
  const word=side<0?'west':'east',main=bed(word+'-main-garden-band',side*21.75,-39.05,20,10.8,.95);
  for(const[i,x]of [16.4,27.2].entries())placements.push({
   id:main.id+'-juniper-'+i,bedId:main.id,species:'juniper',x:side*x,z:-40.4,
   scale:side<0?(i?.98:.88):(i?1.02:.92),yaw:side*(i?.37:-.28),designRole:'clipped-vertical-rhythm'});
  bed(word+'-stair-side-band',side*21,-19.1,18,3,.65);
 }
  return freeze({id:'xieqiqu-court-garden-r3-bands',status:'work-candidate-not-production-admitted',
    historicallySurveyed:false,nativeReviewed:false,
    evidence:{id:'xieqiqu-court-garden-r3-bands',historicallySurveyed:false,nativeReviewed:false,
      description:'Contemporary paired formal garden bands: open fountain ring/axis and clipped vertical rhythm follow observed north copperplate relationships; exact coordinates, materials, botanical identities and mineral pattern are authored.',
      sources:['https://www.dpm.org.cn/learing_detail/379500.html','https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html']},
    frame:{position:[395,4,-565],yaw:0,scale:1},beds,placements,reservations:baseline.reservations,
    levels:{apronTop:.016,soilTop:.085,borderTop:.120,rootBurial:.006},
    architectureAuditLocalBounds:{min:[-33,.023,-46],max:[33,6.20,-16.10]},
    sourceLayout:{regions:[{id:'xieqiqu-court-garden-r3-bands',placements:placements.map(p=>({species:p.species}))}]},
    requiredAdapter:['complete instanced juniper source profile','borrow original nested instanced views','only actual juniper-visible-trunk participates in navigation','continuous soil triangles under small surface mineral patterns; roots sampled from actual soil','plan-derived retained-architecture audit bounds','private border/apron refinement, source floor and roof materials stay isolated']});
}

// Contemporary formal paired bands. Actual full shrubs form overlapping drifts,
// with open pool/axis and original source floors preserved. This is not a survey.
export function createCourtBandsR3Drifts({broadleafRootRadius=roots['low-broadleaf']}={}){
 if(!Number.isFinite(broadleafRootRadius)||broadleafRootRadius<=0||broadleafRootRadius>1)throw new Error('A finite source broadleaf root radius in metres is required');
 const rootRadii={...roots,'low-broadleaf':broadleafRootRadius};
 const first=createCourtBandsSpatialFrame(),beds=JSON.parse(JSON.stringify(first.beds));
 const placements=first.placements.filter(p=>p.species==='juniper').map(p=>({...p})),drifts=[];
 const id='xieqiqu-court-garden-r3-drifts-r2',byBed=new Map(beds.map(b=>[b.id,b]));
 function add(p){
  const bed=byBed.get(p.bedId),r=rootRadii[p.species]*p.scale;
  if(!inRing(p.x,p.z,bed.inner)||edgeDistance(p.x,p.z,bed.inner)<r+.025)return false;
  if(bed.mineralPatches.some(m=>inRing(p.x,p.z,m.ring)||edgeDistance(p.x,p.z,m.ring)<r+.05))return false;
  if(placements.some(q=>q.bedId===p.bedId&&Math.hypot(q.x-p.x,q.z-p.z)<r+rootRadii[q.species]*q.scale+.015))return false;
  placements.push(p);return true;
 }
 for(const side of [-1,1]){
  const word=side<0?'west':'east',bedId=word+'-main-garden-band',bed=byBed.get(bedId);
  // Small irregular mineral shoulders approach the existing tree root domains;
  // the original continuous soil below them remains intact.
  const rings=[
   [[17.23,-40.00],[17.55,-40.20],[18.05,-40.15],[18.80,-39.75],[19.20,-39.00],[19.25,-38.45],[18.90,-37.96],[18.35,-38.00],[17.90,-38.45],[17.45,-39.10]],
   [[26.35,-40.23],[26.20,-40.55],[25.70,-40.70],[25.08,-40.36],[24.65,-39.80],[24.45,-39.15],[24.62,-38.58],[25.18,-38.35],[25.68,-38.75],[26.03,-39.42]]
  ];
  bed.mineralPatches=rings.map((ring,i)=>({id:bedId+'-mineral-shoulder-'+i,kind:'surface-mineral-pattern',ring:ring.map(([x,z])=>[side*x,z])}));
  // Two connected low flower clusters highlight turning shoulders.
  const flowerOffsets=[[-.53,-.10],[-.12,-.44],[.38,-.30],[.64,.14],[.10,.42],[-.38,.32]];
  for(const [gi,[cx,cz]]of [[14.85,-36.10],[28.80,-35.65]].entries())for(const[i,[dx,dz]]of flowerOffsets.entries()){
   add({id:bedId+'-flower-cluster-'+gi+'-'+i,bedId,species:'flower-shrub',x:side*(cx+dx),z:cz+dz,
    scale:.98+.045*(i%3),yaw:side*(gi*.8+i*1.69),designRole:'connected-low-flowering-accent'});
  }
  const lobes=[
   {name:'inner-back',cx:15.60,cz:-40.20,rx:2.72,rz:2.88},
   {name:'linking-back',cx:21.20,cz:-41.10,rx:4.10,rz:2.38},
   {name:'outer-shoulder',cx:28.20,cz:-39.60,rx:2.60,rz:2.82},
   {name:'front-crescent',cx:21.15,cz:-36.25,rx:4.40,rz:1.70},
   {name:'inner-link',cx:16.90,cz:-37.70,rx:2.05,rz:1.68},
   {name:'outer-link',cx:25.42,cz:-37.17,rx:2.25,rz:1.70}
  ];
  for(const[li,lobe]of lobes.entries()){
   const driftId=bedId+'-'+lobe.name;drifts.push({...lobe,cx:lobe.cx*side,id:driftId,bedId,species:'low-broadleaf',intent:'Connected mid-height shoulder; wider body tapers into adjoining drift'});
   for(let i=0;i<320;i++){
    const r=Math.sqrt((i+.5)/320),a=i*PHI+li*.77+side*.31;
    const x=side*(lobe.cx+lobe.rx*r*Math.cos(a)),z=lobe.cz+lobe.rz*r*Math.sin(a),scale=1.30+.18*Math.pow(1-r,.55);
    if(placements.some(p=>p.bedId===bedId&&p.species==='low-broadleaf'&&Math.hypot(p.x-x,p.z-z)<.81+.10*r))continue;
    if(placements.some(p=>p.bedId===bedId&&p.species==='flower-shrub'&&Math.hypot(p.x-x,p.z-z)<.73))continue;
    add({id:driftId+'-'+i,bedId,species:'low-broadleaf',x,z,scale,yaw:side*(i*PHI+li*.53),designRole:'mid-height-broadleaf-drift',driftId});
   }
  }
  // Fill designed variable-width ribbons with a deterministic non-grid sequence.
  // Roots share edge zones with shrub shoulders, while crown centres stay clear.
  for(let i=0;i<10000;i++){
   const x=12.13+19.24*fract((i+.5)*.7548776662466927+side*.117),z=-44.07+10.04*fract((i+.5)*.5698402909980532+side*.073);
   const front=-34.63+.17*Math.sin((x-12)*.58),frontWidth=.36+.65*bell(x,17.1,2.4)+.43*bell(x,26.3,2.0);
   const back=-43.35+.18*Math.sin((x-12)*.44),backWidth=.30+.45*bell(x,20.1,3.0)+.29*bell(x,28.6,1.7);
   const leftWidth=.36+.42*bell(z,-38.9,2.1),rightWidth=.30+.35*bell(z,-37.8,2.0);
   if(!(Math.abs(z-front)<frontWidth||Math.abs(z-back)<backWidth||Math.abs(x-12.62)<leftWidth||Math.abs(x-30.89)<rightWidth))continue;
   const X=side*x,variation=.5+.5*Math.sin(x*.93+z*.74),scale=.68+.18*variation;
   if(placements.some(p=>p.bedId===bedId&&p.species==='sedge'&&Math.hypot(p.x-X,p.z-z)<.255+.035*variation))continue;
   if(placements.some(p=>p.bedId===bedId&&p.species==='low-broadleaf'&&Math.hypot(p.x-X,p.z-z)<.39*p.scale))continue;
   if(placements.some(p=>p.bedId===bedId&&p.species==='flower-shrub'&&Math.hypot(p.x-X,p.z-z)<.34))continue;
   add({id:bedId+'-grass-shoulder-'+i,bedId,species:'sedge',x:X,z,scale,yaw:side*(i*PHI),designRole:'variable-width-low-grass-shoulder'});
  }
  const ribbon=word+'-stair-side-band';
  for(let i=0;i<3500;i++){
   const x=12.35+17.32*fract((i+.5)*.7548776662466927+side*.131),z=-20.42+2.64*fract((i+.5)*.5698402909980532+side*.079);
   const centre=-19.10+.13*Math.sin((x-12)*.44),width=.39+.52*bell(x,17.5,2.4)+.42*bell(x,25.8,2.5);
   if(Math.abs(z-centre)>width)continue;
   const X=side*x,variation=.5+.5*Math.sin(x*.83+z*.67),scale=.68+.18*variation;
   if(placements.some(p=>p.bedId===ribbon&&Math.hypot(p.x-X,p.z-z)<.265+.025*variation))continue;
   add({id:ribbon+'-grass-drift-'+i,bedId:ribbon,species:'sedge',x:X,z,scale,yaw:side*(i*PHI),designRole:'tapering-stair-side-grass-drift'});
  }
 }
 return freeze({...first,id,beds,placements,drifts,status:'work-drifts-r2-awaiting-native-composition',
  evidence:{...first.evidence,id,description:first.evidence.description+' Complete scanned mid-height drifts and variable-width grass shoulders are contemporary exhibit design, not a historic planting reconstruction.'},
  sourceLayout:{regions:[{id,placements:placements.map(p=>({species:p.species}))}]},
  sourceProfileEvidence:{'low-broadleaf':'work/yuanmingyuan/court-low-broadleaf-r1/freeze.json',sourceTriangles:1020245,alphaAreaUnitM2:.4595591180555555,rootMinY:-.03000451624393463,rootRadius:broadleafRootRadius,alphaTest:.5}
 });
}
