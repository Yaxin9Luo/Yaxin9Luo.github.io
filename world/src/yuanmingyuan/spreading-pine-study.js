import * as THREE from 'three';
import {seededGardenRandom,VegetationGeometryBatch,VegetationInstanceBatch} from './vegetation-geometry.js';
import {pineBarkTextures,pineBarkRelief,validateVegetationTexturePixels,vegetationBarkSource} from './vegetation-textures.js';
import {V,TAU,curveOf,tubePoint,aim,pose,pineWoodGeometry,pineTerminalSpray} from './spreading-pine-geometry.js';
import {spreadingPineReviewViews} from './spreading-pine-views.js';

export const pineR4Specification=Object.freeze({
 id:'spreading-garden-pine-r4',evidence:'contemporary-authored-natural-garden-pine',
 sourceIds:['flora-pine','photography-pine','material-pine-bark'],
 desiredAboveGroundHeight:[3.8,4.6],desiredCrownWidth:[5,6.8],
 needleLengthRange:[.085,.128],needleWidthRange:[.0012,.00148],
 realNeedleCrossSection:'semiorbicular',textureSize:[1024,1024],lod:false,
 historicalIndividual:false,defaultRegistration:false,
});

export function createSpreadingPineStudy({texturePixels}={}){
 validateVegetationTexturePixels(texturePixels);
 const group=new THREE.Group();group.name='yuanming-spreading-pine-study-r4';group.userData={evidence:pineR4Specification.evidence,fullGardenDistribution:false,historicalIndividual:false};
 const root=new THREE.Group();root.name='garden-pine';root.userData={id:'pine',label:'横展庭园松 · R4',evidence:pineR4Specification.evidence,sourceIds:pineR4Specification.sourceIds,pineForm:'spreading-garden-r4',historicalIndividual:false};group.add(root);
 const geometries=new Set(),materials=new Set(),textures=new Set(),instances=new Set();let disposed=false;
 const release=()=>{if(disposed)return;disposed=true;for(const m of instances)m.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.clear();};
 try{
  const maps=pineBarkTextures(texturePixels),surface=pineBarkRelief(texturePixels);Object.values(maps).forEach(t=>textures.add(t));
  const bark=new THREE.MeshStandardMaterial({name:'pine-r3-continuous-photographic-bark',color:0xffffff,vertexColors:true,...maps,normalScale:new THREE.Vector2(.76,.76),roughness:1});materials.add(bark);
  bark.userData={source:vegetationBarkSource,woodOrders:'trunk-roots-primary-secondary-terminal',materialRole:'one-shared-original-PBR-bark-all-orders',originalPixelsUnchanged:true};
  const leaf=new THREE.MeshStandardMaterial({name:'pine-r3-semi-round-live-needles',color:0xffffff,vertexColors:true,roughness:.73,emissive:'#1c2e18',emissiveIntensity:.018});materials.add(leaf);
  // Pin the original R3 canopy state independently of root-shape choices.
  // The initial eight-root construction consumed 32 draws before canopy growth.
  const rng=seededGardenRandom(1340406461),trunkBatch=new VegetationGeometryBatch('pine-r3-trunk-and-roots'),boughBatch=new VegetationGeometryBatch('pine-r3-primary-boughs'),fineBatch=new VegetationGeometryBatch('pine-r3-secondary-and-terminal-boughs'),woodRecords=[],shootSupports=[],pads=[];
  const addWood=(batch,id,points,radii,options,parent=null)=>{
   const firstTriangle=batch.indices.length/3,g=pineWoodGeometry({name:id,points,radii,surface,...options}),record={id,batch:batch.name,firstTriangle,triangleCount:g.index.count/3,...g.userData,parent};
   batch.add(g);g.dispose();woodRecords.push(record);return {id,curve:curveOf(points),segments:options.segments,record};
  };
  const trunkPoints=[[0,-.13,0],[-.08,.52,.025],[-.28,1.27,.06],[-.025,2.08,.12],[-.18,2.72,.05],[.18,3.35,.025],[.27,3.72,.08]],trunkRadii=[.44,.325,.27,.22,.15,.083,.018];
  const trunk=addWood(trunkBatch,'trunk',trunkPoints,trunkRadii,{segments:440,radialSegments:112,seed:1291,tileMetres:2,relief:.48,tint:.91});
  // Unequal, thickened root collars broaden below the trunk and curve into
  // ground at y=0. Short round tip profiles stay underground; long spear-like
  // cones and a repeated star-shaped root skirt are deliberately avoided.
  const rootDirections=[.18,1.13,1.91,2.78,3.86,4.80,5.58],rootReach=[.76,.89,.66,.83,.74,.94,.69];
  rootDirections.forEach((angle,i)=>{
   const reach=rootReach[i],bend=Math.sin(i*2.19)*.16,start=tubePoint(trunk.curve,.083+i%3*.011,trunk.segments),point=(r,y,k=1)=>V(Math.cos(angle+bend*k)*r,y,Math.sin(angle+bend*k)*r);
   addWood(trunkBatch,'root-'+i,[start,point(reach*.26,.16,.2),point(reach*.52,.055,.5),point(reach*.73,-.015,.8),point(reach*.91,-.09),point(reach*.97,-.113,1.07),point(reach,-.129,1.1)],[.20,.158,.105,.069,.052,.037,.004],{segments:112,radialSegments:40,seed:179+i*31,tileMetres:2,relief:.34,tint:.91},{id:'trunk',point:start.toArray()});
  });
  // Deliberately unequal scaffold lengths, heights and subordinate pads. Needle
  // growth begins on the distal branches so the load-bearing wood stays legible.
  const primary=[
   {t:.235,angle:3.03,length:2.55,rise:.20,drop:-.11,width:.55,forks:7,role:'long-low-left'},
   {t:.305,angle:.08,length:2.38,rise:.31,drop:-.15,width:.62,forks:7,role:'long-low-right'},
   {t:.40,angle:4.72,length:1.91,rise:.13,drop:-.10,width:.55,forks:6,role:'back-lower'},
   {t:.505,angle:2.88,length:2.17,rise:.22,drop:-.17,width:.64,forks:7,role:'middle-left'},
   {t:.565,angle:6.08,length:2.36,rise:.30,drop:-.11,width:.69,forks:7,role:'dominant-middle-right'},
   {t:.655,angle:1.14,length:1.11,rise:.10,drop:-.06,width:.38,forks:5,role:'small-forward'},
   {t:.745,angle:3.54,length:1.65,rise:.20,drop:-.10,width:.55,forks:6,role:'upper-left'},
   {t:.825,angle:5.15,length:1.25,rise:.08,drop:-.07,width:.49,forks:5,role:'upper-back'},
   {t:.868,angle:.17,length:1.36,rise:.13,drop:-.07,width:.50,forks:6,role:'upper-right'},
   {t:.956,angle:1.80,length:.67,rise:.09,drop:-.02,width:.42,forks:5,role:'uneven-apex'},
  ];
  const sprays=[218,591,832,1049].map(seed=>{const s=pineTerminalSpray({seed,surface});geometries.add(s.wood);geometries.add(s.needles);return s;});
  const foliage=sprays.map((_,i)=>new VegetationInstanceBatch('pine-r3-needle-sprays-'+i)),sprayWood=sprays.map((_,i)=>new VegetationInstanceBatch('pine-r3-barked-spray-axes-'+i));
  primary.forEach((p,arm)=>{
   const start=tubePoint(trunk.curve,p.t,trunk.segments),out=V(Math.cos(p.angle),0,Math.sin(p.angle)),across=V(-Math.sin(p.angle),0,Math.cos(p.angle)),tip=start.clone().addScaledVector(out,p.length).add(V(0,p.rise,0));
   const points=[start,start.clone().addScaledVector(out,p.length*.22).add(V(0,p.drop,0)),start.clone().lerp(tip,.59).addScaledVector(across,Math.sin(arm*2.17)*.14).add(V(0,p.drop*.64,0)),start.clone().lerp(tip,.82).addScaledVector(across,Math.sin(arm*1.67)*.13).add(V(0,p.rise*.05,0)),tip];
   const radius=.143-arm*.009,main=addWood(boughBatch,'primary-'+arm,points,[radius,radius*.88,radius*.55,radius*.27,.0075],{segments:148,radialSegments:52,seed:197+arm*153,tileMetres:2,relief:.40,tint:.91},{id:'trunk',point:start.toArray()});
   const pad={arm,role:p.role,primary:main.id,shoots:[],primaryPoints:points.map(v=>v.toArray())};
   for(let fork=0;fork<p.forks;fork++){
    const f=(fork+.25+rng()*.35)/p.forks,side=fork%2?-1:1,t=.46+f*.48,at=tubePoint(main.curve,t,main.segments),along=Math.min(.99,.62+f*.37),end=main.curve.getPointAt(along).addScaledVector(across,side*p.width*(.65+rng()*.35)).addScaledVector(out,(rng()-.35)*.16).add(V(0,.035+Math.sin(fork*2.1+arm)*.075,0)),secondaryPoints=[at,at.clone().lerp(end,.47).add(V(0,-.065-rng()*.045,0)),end],secondaryId='secondary-'+arm+'-'+fork;
    const secondary=addWood(fineBatch,secondaryId,secondaryPoints,[.034,.018,.0043],{segments:32,radialSegments:16,seed:479+arm*113+fork*19,tileMetres:.75,relief:.22,tint:.91},{id:main.id,point:at.toArray()});
    const terms=5+(fork+arm)%3,clusterTint=.92+rng()*.095;
    for(let term=0;term<terms;term++){
     const st=.30+(term+.3+rng()*.30)/terms*.66,attach=tubePoint(secondary.curve,st,secondary.segments),theta=p.angle+side*(.46+rng()*.65)+(term%2?-.26:.31),direction=V(Math.cos(theta),.23+rng()*.18,Math.sin(theta)).normalize(),reach=.24+rng()*.18,endTerm=attach.clone().addScaledVector(direction,reach),twigPoints=[attach,attach.clone().lerp(endTerm,.48).add(V(0,-.018,0)),endTerm],twigId='terminal-'+arm+'-'+fork+'-'+term;
     const twig=addWood(fineBatch,twigId,twigPoints,[.008,.0047,.0015],{segments:20,radialSegments:10,seed:807+arm*199+fork*53+term*17,tileMetres:.45,relief:.14,tint:.89},{id:secondary.id,point:attach.toArray()});
     const mounts=(fork+term+arm)%4===0?[.46,.74,.965]:[.65,.965];
     mounts.forEach((mt,k)=>{
      const point=tubePoint(twig.curve,mt,twig.segments),tangent=twig.curve.getTangentAt(mt),growth=tangent.clone().multiplyScalar(.75).add(V((rng()-.5)*.07,.36+rng()*.18,(rng()-.5)*.07)),index=(arm*3+fork+term+k)%sprays.length,matrix=pose(point,aim(growth,rng()*TAU)),instance=foliage[index].matrices.length/16;
      foliage[index].add(matrix,clusterTint*(.99+rng()*.02));sprayWood[index].add(matrix,1);
      shootSupports.push({arm,fork,term,cluster:k,index,instance,parent:twigId,t:mt,point:point.toArray()});pad.shoots.push(shootSupports.length-1);
     });
    }
   }pads.push(pad);
  });
  // The complete R3 scaffold and its RNG stream finish above. Grow only the
  // connected top continuation below, from an independent deterministic stream.
  const inherited={woodRecords:woodRecords.length,shoots:shootSupports.length,pads:pads.length},crownRng=seededGardenRandom(4109271),crownBatch=new VegetationGeometryBatch('pine-r4-connected-crown');
  const crownStartT=.972,crownStart=tubePoint(trunk.curve,crownStartT,trunk.segments),crownPoints=[crownStart,V(...trunkPoints.at(-1)),V(.245,3.845,.045),V(.12,3.985,-.055),V(.005,4.055,-.105)];
  const leader=addWood(crownBatch,'crown-leader',crownPoints,[.037,.025,.019,.009,.0025],{segments:96,radialSegments:32,seed:41903,tileMetres:.75,relief:.22,tint:.91},{id:'trunk',point:crownStart.toArray()});
  const crownPad={arm:primary.length,role:'connected-asymmetric-crown',primary:leader.id,shoots:[],primaryPoints:crownPoints.map(v=>v.toArray())};
  const mountCrown=(parent,t,{fork,term,cluster=0,index,tint=.97}={})=>{
   const point=tubePoint(parent.curve,t,parent.segments),tangent=parent.curve.getTangentAt(t),growth=tangent.clone().multiplyScalar(.82).add(V((crownRng()-.5)*.05,.30+crownRng()*.12,(crownRng()-.5)*.05)),matrix=pose(point,aim(growth,crownRng()*TAU)),instance=foliage[index].matrices.length/16;
   foliage[index].add(matrix,tint*(.99+crownRng()*.02));sprayWood[index].add(matrix,1);
   shootSupports.push({arm:crownPad.arm,fork,term,cluster,index,instance,parent:parent.id,t,point:point.toArray(),growthRegion:'r4-crown'});crownPad.shoots.push(shootSupports.length-1);
  };
  // Unequal branch origins, reach and lift avoid another horizontal tier or a
  // repeated scooped U profile. Each terminal has an indexed woody parent.
  const crownBranches=[
   {t:.30,angle:3.68,reach:.43,rise:.045,bend:.075,twigs:4,role:'long-back-left'},
   {t:.43,angle:.48,reach:.36,rise:.095,bend:-.045,twigs:4,role:'forward-right'},
   {t:.59,angle:5.19,reach:.34,rise:.055,bend:.025,twigs:3,role:'short-back'},
   {t:.76,angle:2.21,reach:.28,rise:.045,bend:-.035,twigs:3,role:'high-left'},
   {t:.89,angle:.08,reach:.19,rise:.035,bend:.045,twigs:2,role:'small-high-right'},
  ];
  crownBranches.forEach((branch,fork)=>{
   const start=tubePoint(leader.curve,branch.t,leader.segments),out=V(Math.cos(branch.angle),0,Math.sin(branch.angle)),across=V(-out.z,0,out.x),end=start.clone().addScaledVector(out,branch.reach).add(V(0,branch.rise,0)),points=[start,start.clone().lerp(end,.43).addScaledVector(across,branch.bend).add(V(0,.016+fork*.003,0)),end],radius=.014-fork*.0013;
   const arm=addWood(crownBatch,'crown-branch-'+fork,points,[radius,radius*.56,.0026],{segments:44,radialSegments:18,seed:42101+fork*71,tileMetres:.75,relief:.18,tint:.91},{id:leader.id,point:start.toArray()});
   for(let term=0;term<branch.twigs;term++){
    const t=.40+(term+.35)/branch.twigs*.55,attach=tubePoint(arm.curve,t,arm.segments),angle=branch.angle+(term%2?-.50:.39)+(crownRng()-.5)*.20,direction=V(Math.cos(angle),.35+crownRng()*.24,Math.sin(angle)).normalize(),reach=.145+crownRng()*.075,tip=attach.clone().addScaledVector(direction,reach),twigPoints=[attach,attach.clone().lerp(tip,.50).addScaledVector(across,(term%2?1:-1)*.018),tip];
    const twig=addWood(crownBatch,'crown-terminal-'+fork+'-'+term,twigPoints,[.0058,.0034,.0012],{segments:20,radialSegments:10,seed:42807+fork*113+term*19,tileMetres:.45,relief:.14,tint:.89},{id:arm.id,point:attach.toArray()});
    [.59,.965].forEach((mt,k)=>mountCrown(twig,mt,{fork,term,cluster:k,index:(fork*3+term+k)%sprays.length,tint:.935+crownRng()*.055}));
   }
   mountCrown(arm,.968,{fork,term:branch.twigs,index:(fork+2)%sprays.length,tint:.97});
  });
  [.89,.982].forEach((t,k)=>mountCrown(leader,t,{fork:crownBranches.length,term:0,cluster:k,index:(k+1)%sprays.length,tint:.985}));
  pads.push(crownPad);
  const crownExtension={seed:4109271,parent:'trunk',startT:crownStartT,start:crownStart.toArray(),oldTrunkTip:trunkPoints.at(-1),leader:leader.id,branches:crownBranches,inherited,addedWood:woodRecords.length-inherited.woodRecords,addedSprays:shootSupports.length-inherited.shoots,method:'Append a true woody continuation and unequal upper branches after the unchanged complete R3 source; no original instance or geometry changes.'};
  const mesh=(geometry,material,name)=>{geometries.add(geometry);const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;root.add(m);return m;};
  for(const batch of [trunkBatch,boughBatch,fineBatch,crownBatch])mesh(batch.finish(),bark,batch.name);
  sprays.forEach((spray,i)=>{for(const [batch,g,material]of [[sprayWood[i],spray.wood,bark],[foliage[i],spray.needles,leaf]]){const m=batch.finish(g,material);m.castShadow=m.receiveShadow=true;instances.add(m);root.add(m);}});
  root.userData.growth={branchOrders:6,primaryBoughs:primary.length,terminalArchitecture:'distal-paired-semi-round-needles-on-four-axis-sprays',physicalLeafScale:true,originalNeedleGeometryReused:true,needleGeometrySourceRevision:3,windAmplitude:0};
  root.userData.shapeEvidence={primary,crownExtension,trunk:trunkPoints,trunkRadii,woodRecords,pads,shootSupports,prototypes:sprays.map((s,i)=>({index:i,axes:s.axes,needles:s.needleRecords}))};
  group.updateMatrixWorld(true);let triangles=0,meshCount=0,instanceCount=0;root.traverse(n=>{if(n.isMesh){meshCount++;const count=n.isInstancedMesh?n.count:1;triangles+=n.geometry.index.count/3*count;if(n.isInstancedMesh)instanceCount+=count;}});
  const bounds=new THREE.Box3().setFromObject(group),measure={min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(V()).toArray()},fascicles=shootSupports.reduce((n,s)=>n+sprays[s.index].needleRecords.length/2,0);
  const diagnostics={id:pineR4Specification.id,evidence:pineR4Specification.evidence,sourceIds:pineR4Specification.sourceIds,subassemblies:[{id:'pine',name:'garden-pine',triangles,meshes:meshCount,instances:instanceCount,bounds:measure}],triangleCount:triangles,meshCount,authoredElements:{curvedBranches:woodRecords.length,livePineShoots:shootSupports.length,needleFascicles:fascicles,needles:fascicles*2},bounds:measure,metresSurveyed:false,fullGardenDistribution:false,renderVerified:false,limitations:['This is a contemporary authored tree, not a recovered historic Yuanmingyuan specimen.','R4 appends one connected asymmetric upper crown; all R3 scaffold and four spray prototypes plus original instance prefixes remain byte-identical.','All original 1K bark channels remain unchanged; younger wood uses documented .75 m and .45 m UV adaptation.','Single-tree native views support contemporary composition trials; final garden contact and complete-scene acceptance remain pending.']};
  return {group,specimens:[root],diagnostics,views:spreadingPineReviewViews,dispose:release,whenIdle:async()=>{}};
 }catch(error){release();throw error;}
}
