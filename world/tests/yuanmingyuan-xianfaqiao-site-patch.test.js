import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {gardenLayout,pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {createMuseumLandscape} from '../src/yuanmingyuan/museum-landscape.js';
import {createXianfaqiaoSitePatch,activateXianfaqiaoSitePatch,applyXianfaqiaoSitePatch,bindXianfaqiaoSourceWater} from '../src/yuanmingyuan/xianfaqiao-site-patch.js';
import {xianfaqiaoArchive} from '../src/yuanmingyuan/xianfaqiao-integration.js';
import {flowerOutline} from '../src/yuanmingyuan/xieqiqu-geometry.js';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {bindXieqiquFountainWater} from '../src/yuanmingyuan/xieqiqu-court-ground.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {createGardenWater} from '../src/yuanmingyuan/garden-water.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createPersistentEnsemble} from '../src/yuanmingyuan/persistent-ensemble.js';
import {museumSupport} from '../src/yuanmingyuan/museum-support.js';
import {GardenGateBuilder} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {BRIDGE,fiveSluiceWallGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {addXianfaqiaoDeck,addXianfaqiaoAbutment} from '../src/yuanmingyuan/xianfaqiao-deck-joins.js';
import {polygonBooleanRegions,polygonArea,distanceToRing,createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {assertClosedWinding,assertGeometryNormals} from './yuanmingyuan-garden-study-checks.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const near=(a,b,e=1e-4)=>assert(Math.abs(a-b)<=e,`${a} != ${b}`);
const intersect=(a,b)=>polygonBooleanRegions([a,b],p=>pointInPolygon(p,a)&&pointInPolygon(p,b)).area;
const candidate=createXianfaqiaoSitePatch(),{manifestSHA256,glbSHA256}=xianfaqiaoArchive;
// Identity metadata exercises the binding contract only. These deliberately
// small real components are not an archive decode or full-model admission.
const admission={nativeApproved:true,manifestSHA256,glbSHA256,scope:'synthetic-component-fixture'};
function placed(group,site){group.position.fromArray(site.position);group.rotation.y=site.rotationY;group.scale.setScalar(site.scale);group.updateMatrixWorld(true);}
function fixtureOwners({buildSupport=true}={}){
  const b=new GardenGateBuilder('xianfaqiao-site-component-fixture'),group=new THREE.Group(),base=new THREE.Group(),banks=new THREE.Group(),wet=new THREE.Group();
  base.name='xianfaqiao-five-opening-sluice';banks.name='xianfaqiao-study-grounded-abutments';wet.name='xianfaqiao-study-water-channel';group.add(base,banks,wet);
  b.add(base,fiveSluiceWallGeometry(),b.m.wetStone);addXianfaqiaoDeck(b,base);for(const side of [-1,1])addXianfaqiaoAbutment(b,banks,base,side);
  b.polygon(wet,rect(-16.2,-10,16.2,10),-1.81,-1.70,b.m.wetStone);
  b.polygon(wet,rect(-16.1,-10,16.1,10),-.726,-.72,b.m.water);
  const bridgeOwner=b.finish(group,{assetId:'actual-bridge-components-only'});bridgeOwner.archive={id:'xianfaqiao',glbSHA256};
  placed(group,candidate.site);
  const peerGroup=new THREE.Group(),stone=new THREE.MeshStandardMaterial(),surface=new THREE.MeshStandardMaterial({transparent:true}),flow=new THREE.MeshStandardMaterial({transparent:true}),geometries=[];
  surface.userData={category:'water',role:'surface'};flow.userData={category:'water',role:'flow'};
  function box(parent,center,size,material){const geometry=new THREE.BoxGeometry(...size),mesh=new THREE.Mesh(geometry,material);geometries.push(geometry);mesh.position.fromArray(center);parent.add(mesh);return mesh;}
  function polygon(parent,ring,bottom,top,material,holes=[]){const geometry=extrudedPolygon(ring,bottom,top,holes),mesh=new THREE.Mesh(geometry,material);geometries.push(geometry);parent.add(mesh);return mesh;}
  // Exact source paving/flower voids/stone beds and cropped foreground sheet,
  // without constructing the building, fountain sculpture or ornament factories.
  const poolData=[['xieqiqu-south-haitang-pool','haitang',26,13,8.5],['xieqiqu-north-chrysanthemum-pool','chrysanthemum',-27,4.8,4.8]];
  const profiles=poolData.map(([,kind,z,rx,rz])=>{const outer=flowerOutline(kind,0,z,rx,rz);return {outer,inner:outer.map(([x,pz])=>[x*.957,z+(pz-z)*.957])};});
  const paving=polygon(peerGroup,rect(-52,-51,52,40.75),-.65,0,stone,profiles.map(p=>p.outer));paving.name='xieqiqu-court-paving';
  const flowerSheets=[],flowerBeds=[];
  poolData.forEach(([name],i)=>{const basin=new THREE.Group();basin.name=name;peerGroup.add(basin);const {outer,inner}=profiles[i];
    polygon(basin,outer,-.60,.43,stone,[inner]);flowerBeds.push(polygon(basin,inner,-.61,-.45,stone));flowerSheets.push(polygon(basin,inner,.114,.13,surface));});
  const lake=new THREE.Group();lake.name='xieqiqu-south-lake-foreground';peerGroup.add(lake);
  const bed=box(lake,[0,-.90,46.38],[104,.1,11.25],stone),sheet=box(lake,[0,-.207,46.38],[104,.014,11.25],surface);
  box(lake,[0,-.325,40.89],[104,1.10,.44],stone);
  // Non-surface role and another group sharing the material are sentinels for
  // the narrow handoff, not invented fountain geometry or appearance evidence.
  const jet=box(lake,[0,10,0],[.1,.1,.1],flow),otherSheet=box(peerGroup,[0,20,0],[.1,.1,.1],surface);
  let released=0;const peerOwner={group:peerGroup,archive:{id:'xieqiqu',glbSHA256:'c'.repeat(64)},dispose(){if(released)return;released++;geometries.forEach(g=>g.dispose());stone.dispose();surface.dispose();flow.dispose();peerGroup.clear();}};
  placed(peerGroup,candidate.peerSite);
  const bridgeSupport=buildSupport?createArchitectureSurface(group):null,peerSupport=buildSupport?createArchitectureSurface(peerGroup):null;
  return {bridge:{owner:bridgeOwner,support:bridgeSupport},peer:{owner:peerOwner,support:peerSupport},bed,sheet,jet,otherSheet,paving,flowerSheets,flowerBeds,get released(){return released;},
    dispose(){bridgeSupport?.dispose();peerSupport?.dispose();bridgeOwner.dispose();peerOwner.dispose();}};
}
function activeWith(owners){return activateXianfaqiaoSitePatch(candidate,{admission,bridge:owners.bridge,peer:owners.peer});}
const localCoast=rect(275,-615,478,-437);
function localLayout(plan){
  const clip=ring=>polygonBooleanRegions([localCoast,ring],p=>pointInPolygon(p,localCoast)&&pointInPolygon(p,ring)).regions;
  return {id:'xianfaqiao-bounded-actual-geometry-fixture',exhibition:{groundY:4,seaY:0,coast:{polygon:localCoast}},
    gardens:plan.layout.gardens.filter(g=>['yuanmingyuan','changchunyuan'].includes(g.id)).map(g=>({...g,boundary:clip(g.boundary)[0].outer})),
    channels:[{...candidate.channel,polygon:clip(candidate.channel.polygon)[0].outer}],waterBodies:[],ornamentalWaters:[],islands:[],landforms:[],bridges:[]};
}
let owners,active,plan,terrain;const stats={scope:'bounded CPU component fixture; no full asset factory, archive decode, GPU or native admission'},start=performance.now();
test.before(()=>{
  owners=fixtureOwners();active=activeWith(owners);plan=createMuseumLandscape({sites:[candidate.peerSite],readyAssetIds:['xieqiqu'],xianfaqiaoPatch:active});
  const begin=performance.now();terrain=createGardenTerrain({layout:localLayout(plan),assetCourts:plan.courts,assetPads:plan.pads,assetPaths:plan.paths});
  terrain.group.updateMatrixWorld(true);stats.terrainBuildMs=performance.now()-begin;stats.terrain=terrain.diagnostics;
});
test.after(()=>{
  let disposals=0;for(const w of terrain.waterSurfaces)w.geometry.addEventListener('dispose',()=>disposals++);
  terrain.dispose();terrain.dispose();owners.dispose();stats.waterGeometriesDisposed=disposals;stats.expectedWaterGeometries=terrain.waterSurfaces.length;
  stats.totalMs=performance.now()-start;stats.peakRSSBytes=process.resourceUsage().maxRSS*1024;
  if(process.env.XIANFAQIAO_SITE_REPORT)writeFileSync(process.env.XIANFAQIAO_SITE_REPORT,JSON.stringify(stats,null,2)+'\n');
});

test('default and inactive candidate preserve current inputs; a forged active flag cannot remove coarse terrain',()=>{
  const original=JSON.stringify(gardenLayout),normal=createMuseumLandscape(),inactive=createMuseumLandscape({xianfaqiaoPatch:candidate});
  assert.deepEqual(normal,inactive);assert.equal(candidate.active,false);assert.equal(candidate.initializationOnly,true);assert(Object.isFrozen(candidate.prepared.courts[0].polygon));
  assert.throws(()=>createMuseumLandscape({xianfaqiaoPatch:{...candidate,active:true}}),/not a readiness/);
  assert.throws(()=>candidate.channel.centerline[2][0]=0,TypeError);
  assert.equal(JSON.stringify(gardenLayout),original);
  assert.throws(()=>createXianfaqiaoSitePatch({xieqiquSite:{...candidate.peerSite,position:[400,4,-565]}}),/changed Xieqiqu frame/);
});

test('both shared boundaries move together and the combined garden outline remains exactly the same region',()=>{
  const before=gardenLayout.gardens.filter(g=>['yuanmingyuan','changchunyuan'].includes(g.id)),after=candidate.gardenBoundaries;
  const all=[...before.map(g=>g.boundary),...after.map(g=>g.boundary)];
  near(polygonBooleanRegions(all,p=>before.some(g=>pointInPolygon(p,g.boundary))!==after.some(g=>pointInPolygon(p,g.boundary))).area,0,1e-7);
  near(intersect(after[0].boundary,after[1].boundary),0,1e-7);near(candidate.metrics.gardenArea,candidate.metrics.originalGardenArea,1e-7);
  for(const ring of [candidate.peerCourt,...candidate.components.map(c=>c.polygon),...candidate.prepared.paths.map(p=>p.polygon)]){
    near(polygonBooleanRegions([ring,after[1].boundary],p=>pointInPolygon(p,ring)&&!pointInPolygon(p,after[1].boundary)).area,0,1e-7);
    for(const boundary of after)for(let edge=0;edge<boundary.boundary.length;edge++){
      const a=boundary.boundary[edge],b=boundary.boundary[(edge+1)%boundary.boundary.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let step=0;step<=Math.ceil(length/.5);step++){const t=step/Math.ceil(length/.5);assert(!pointInPolygon([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],ring),'neither old owner may leave a wall segment inside the courtyard, water or approach');}
    }
  }
  assert.equal(plan.layout.exhibition,gardenLayout.exhibition);assert.equal(plan.layout.islands,gardenLayout.islands);
  assert.equal(plan.layout.gardens.find(g=>g.id==='qichunyuan'),gardenLayout.gardens.find(g=>g.id==='qichunyuan'));
});

test('the old conflicting channel is a negative control; two local bends preserve its full route and original endpoints',()=>{
  const before=gardenLayout.channels.find(c=>c.id===candidate.channel.id),after=candidate.channel;
  near(intersect(before.polygon,candidate.components[0].polygon),5.089747825782979,1e-6);
  near(intersect(before.polygon,candidate.peerCourt),203.84057908559043,1e-6);
  assert.deepEqual(after.centerline[0],before.centerline[0]);assert.deepEqual(after.centerline.at(-1),before.centerline.at(-1));
  assert.deepEqual(candidate.evidence.bends.map(b=>b.index),[2,3]);assert.equal(after.width,12);assert.equal(after.surfaceY,2);assert.equal(after.bedY,.6);
  for(let i=1;i<after.centerline.length;i++)for(let j=0;j<=100;j++){
    const a=after.centerline[i-1],b=after.centerline[i],t=j/100;assert(pointInPolygon([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],after.polygon));
  }
  assert(candidate.metrics.channelEndpoints.every(end=>end.overlapArea>390));
  near(candidate.metrics.bankGap,10.867414186292672,1e-8);
  for(const ring of [candidate.peerCourt,...candidate.components.map(c=>c.polygon),...candidate.prepared.paths.map(p=>p.polygon)])near(intersect(after.polygon,ring),0,1e-7);
});

test('explicit native identity, placed full owners and real source support are all required before activation',()=>{
  for(const bad of [undefined,{...admission,nativeApproved:false},{...admission,manifestSHA256:'bad'},{...admission,glbSHA256:'d'.repeat(64)}])
    assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission:bad,bridge:owners.bridge,peer:owners.peer}),/admission|hash/);
  assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission,bridge:owners.bridge}),/retained full/);
  const noSource={...owners.peer,support:{surfaceAt:()=>({height:4,walkable:true}),diagnostics:{source:'flat-fallback'}}};
  assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission,bridge:owners.bridge,peer:noSource}),/actual source/);
  const moved=owners.bridge.owner.group;moved.position.x+=1;
  try{assert.throws(()=>createMuseumLandscape({sites:[],xianfaqiaoPatch:active}),/reviewed world transform/);}
  finally{moved.position.x-=1;moved.updateMatrixWorld(true);}
  const fake={...owners.peer,support:{...owners.peer.support,surfaceAt:()=>({height:3.9,walkable:true})}};
  assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission,bridge:owners.bridge,peer:fake}),/real source triangles/);
});

test('a changed layout or released support is rejected without modifying the existing landscape',()=>{
  const original=createMuseumLandscape({sites:[]}),changed={...original,layout:{...original.layout,channels:original.layout.channels.map(c=>c.id===candidate.channel.id?{...c,width:13}:c)}};
  assert.throws(()=>applyXianfaqiaoSitePatch(changed,active),/base layout changed/);assert.equal(original.courts.length,0);
  assert.throws(()=>applyXianfaqiaoSitePatch(plan,active),/base layout changed|already applied/);
  const local=fixtureOwners();try{const token=activeWith(local);local.peer.support.dispose();assert.throws(()=>createMuseumLandscape({sites:[],xianfaqiaoPatch:token}),/actual source/);}finally{local.dispose();}
});

test('optional site application preserves other replacements and adds one connected excavation without ornamental bank generation',()=>{
  const before=createMuseumLandscape({readyAssetIds:['xieqiqu']}),after=createMuseumLandscape({readyAssetIds:['xieqiqu'],xianfaqiaoPatch:active});
  assert.deepEqual(after.replacements,before.replacements);assert.deepEqual(after.courts.slice(0,before.courts.length),before.courts);
  assert.deepEqual(after.pads.slice(0,before.pads.length),before.pads);assert.equal(after.courts.length,before.courts.length+1);
  assert.equal(after.paths.length,before.paths.length+2);assert.equal(after.layout.ornamentalWaters.length,before.layout.ornamentalWaters.length);
  assert.equal(after.sitePatches[0].initializationOnly,true);assert.equal(after.sitePatches[0].admission.scope,'synthetic-component-fixture');
  assert(!terrain.group.children.some(n=>/shore-walk|formal-basin|open-balustrade/.test(n.name)));assert.equal(terrain.bridges.length,0);
});

test('the joined eight-corner hole has no land triangles above the two retained real stone beds',()=>{
  const land=terrain.group.getObjectByName('yuanming-continuous-land');
  for(const [x,z] of [[333,-518.62],[343,-518.62],[400,-518.62],[446,-513.1],[323.1,-533]]){
    const hits=new THREE.Raycaster(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0)).intersectObject(land);assert.equal(hits.length,0);
    const hit=terrain.surfaceAt(x,z);near(hit.height,2.68);near(hit.waterY,3.8);assert.equal(hit.walkable,false);
  }
  const bridgeBed=owners.bridge.support.surfaceAt(339,-518.62,{maxY:3.7}),peerBed=owners.peer.support.surfaceAt(400,-518.62,{maxY:3.7});
  near(bridgeBed.height,2.82);near(peerBed.height,3.15);
  for(const [x,building] of [[339,bridgeBed],[400,peerBed]]){const support=museumSupport(terrain.surfaceAt(x,-518.62),building);assert.equal(support.walkable,false);near(support.waterY,3.8);}
});

test('separate old holes really create a blocking shared wall, and the joined opening removes it in both directions',()=>{
  const layout={...localLayout(plan),gardens:[],channels:[]};let old;
  try{
    old=createGardenTerrain({layout,assetCourts:candidate.components,detail:.15});old.group.updateMatrixWorld(true);
    const ray=(root,x,dx)=>new THREE.Raycaster(new THREE.Vector3(x,3.90,-518.62),new THREE.Vector3(dx,0,0),0,.4).intersectObject(root.getObjectByName('yuanming-asset-court-excavation-walls'));
    assert(ray(old.group,342.8,1).length>0);assert(ray(old.group,343.2,-1).length>0);
    assert.equal(ray(terrain.group,342.8,1).length,0);assert.equal(ray(terrain.group,343.2,-1).length,0);
  }finally{old?.dispose();}
});

test('actual five arch components and excavated terrain leave real water passages, including a continuous forelake connection',()=>{
  const wall=terrain.group.getObjectByName('yuanming-asset-court-excavation-walls'),land=terrain.group.getObjectByName('yuanming-continuous-land');
  for(const x of BRIDGE.pierX)for(const sign of [-1,1]){
    const origin=new THREE.Vector3(x,-.5,sign*5).applyMatrix4(owners.bridge.owner.group.matrixWorld),direction=new THREE.Vector3(0,0,-sign).transformDirection(owners.bridge.owner.group.matrixWorld);
    const ray=new THREE.Raycaster(origin,direction,0,10);assert.equal(ray.intersectObjects([owners.bridge.owner.group,wall,land],true).length,0);
  }
  for(const sign of [-1,1]){
    const ray=new THREE.Raycaster(new THREE.Vector3(sign>0?324:446,3.90,-518.62),new THREE.Vector3(sign,0,0),0,122);
    assert.equal(ray.intersectObjects([owners.bridge.owner.group,owners.peer.owner.group,wall,land],true).length,0);
  }
});

test('both solid ramps keep their original grade and support every tested foot across the actual source butt joins',()=>{
  let count=0;
  for(const path of candidate.prepared.paths){
    const mesh=terrain.group.getObjectByName(`${path.id}-stone-path`);assertClosedWinding(mesh.geometry);assertGeometryNormals(mesh.geometry);assert(path.grade<.06);
    const dx=path.to[0]-path.from[0],dz=path.to[2]-path.from[2],length=Math.hypot(dx,dz);
    for(let i=0;i<=160;i++)for(const side of [-.4,0,.4]){
      const t=i/160,x=path.from[0]+dx*t-dz/length*path.width*side,z=path.from[2]+dz*t+dx/length*path.width*side,expected=path.from[1]+(path.to[1]-path.from[1])*t;
      const hit=terrain.surfaceAt(x,z);assert(hit.walkable);assert(Math.abs(hit.height-expected)<1e-4,`${path.id} t=${t} side=${side}: ${hit.kind} ${hit.height} != ${expected}`);assert.equal(hit.waterY,undefined);count++;
    }
    const high=path.from[1]>path.to[1]?path.from:path.to,hit=owners.bridge.support.surfaceAt(high[0],high[2],{maxY:high[1]+.02});
    near(hit.height,terrain.heightAt(high[0],high[2]));assert(hit.walkable);
  }
  stats.rampSupportQueries=count;
  near(owners.peer.support.surfaceAt(...[347,-566.77],{maxY:4.02}).height,4);
});

test('the 3.8 m sheet has one exact footprint; cut banks meet dry land at 4 m and do not fill the 2 m channel',()=>{
  const court=candidate.prepared.courts[0],sheet=terrain.waterSurfaces.find(w=>w.assetId==='xianfaqiao'),other=terrain.waterSurfaces.filter(w=>w!==sheet);
  assert.equal(other.length,3);assert.deepEqual(other.map(w=>w.worldY).sort(),[2,4.13,4.13]);near(sheet.worldY,3.8);assert.deepEqual(sheet.polygon,court.water.surfacePolygon);
  near(Math.abs(polygonArea(sheet.polygon)),1814,1e-6);
  const sampler=createTriangleSampler([sheet.geometry]);try{
    for(let i=0;i<=200;i++)assert(sampler.sample(324+122*i/200,-518.62),'the shared join is continuous water geometry');
  }finally{sampler.dispose();}
  const p=terrain.group.getObjectByName('yuanming-continuous-land').geometry.attributes.position;let edgeVertices=0;
  for(let i=0;i<p.count;i++)if(distanceToRing([p.getX(i),p.getZ(i)],court.polygon)<4e-5){near(p.getY(i),4,2e-5);edgeVertices++;}
  assert(edgeVertices>20);stats.courtEdgeVertices=edgeVertices;
  const wall=terrain.group.getObjectByName('yuanming-asset-court-excavation-walls');
  for(const [x,z,dx,dz] of [[323.2,-518.62,-1,0],[446.8,-518.62,1,0],[333,-534.6,0,-1]]){
    const hit=new THREE.Raycaster(new THREE.Vector3(x,3.9,z),new THREE.Vector3(dx,0,dz),0,.5).intersectObject(wall)[0];assert(hit);assert(hit.face.normal.dot(new THREE.Vector3(dx,0,dz))<-.9);
  }
  // Traverse the narrowest surveyed-in-this-model separation: one natural
  // sloped bank, solid dry crest, then the independent higher excavation.
  const before=candidate.channel.polygon;let best;
  for(const point of candidate.components[0].polygon)for(let i=0;i<before.length;i++){
    const a=before[i],b=before[(i+1)%before.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(dx*dx+dz*dz))),q=[a[0]+dx*t,a[1]+dz*t],distance=Math.hypot(point[0]-q[0],point[1]-q[1]);
    if(!best||distance<best.distance)best={a:q,b:point,distance};
  }
  near(best.distance,candidate.metrics.bankGap,1e-8);
  const profile=[];
  for(let i=1;i<60;i++){const t=i/60,x=best.a[0]+(best.b[0]-best.a[0])*t,z=best.a[1]+(best.b[1]-best.a[1])*t,hit=terrain.surfaceAt(x,z);assert(hit);assert.equal(hit.waterY,undefined);assert(hit.height>=2-1e-4);profile.push({distance:t*best.distance,x,z,height:hit.height});}
  stats.bankSection=best;
  stats.bankProfile=profile;
});

test('local terrain navigation sees the same dry/wet levels, source deck wins above water and flooded stone remains rejected',()=>{
  const local=terrain.createGuideSupport({minX:320,maxX:451,minZ:-581,maxZ:-459});
  try{for(const [x,z] of [[333,-518.62],[343,-518.62],[400,-518.62],[347,-566.77],[334.75,-480],[319.5,-520]])for(const maxY of [3,3.85,6,Infinity]){
    const a=terrain.surfaceAt(x,z,{maxY}),b=local.surfaceAt(x,z,{maxY});assert.equal(a?.height,b?.height);assert.equal(a?.waterY,b?.waterY);assert.deepEqual(a?.normal,b?.normal);assert.equal(a?.walkable,b?.walkable);
  }}finally{local.dispose();}
  const p=new THREE.Vector3(0,BRIDGE.deckY,1.75).applyMatrix4(owners.bridge.owner.group.matrixWorld),support=museumSupport(terrain.surfaceAt(p.x,p.z),owners.bridge.support.surfaceAt(p.x,p.z,{maxY:6}));
  assert(support.walkable);near(support.height,5.77);
});

function waterOwner(){
  return createGardenWater({terrain,layout:localLayout(plan),resolution:8});
}
test('source sheets are retained until composed water readiness, then only two exact surface roles are hidden and restored',()=>{
  const water=waterOwner(),source=owners.bridge.owner.group.getObjectByName('xianfaqiao-study-water-channel'),bridgeSheet=source.children.find(m=>m.material?.userData?.role==='surface');
  try{
    assert(bridgeSheet.visible&&owners.sheet.visible);
    for(const invalid of [{},{terrain,water:{...water,snapshot:()=>({disposed:true,sheets:[{height:3.8}]})}},{terrain:{...terrain,waterSurfaces:[]},water}])
      assert.throws(()=>bindXianfaqiaoSourceWater(active,invalid),/must be ready/);
    assert(bridgeSheet.visible&&owners.sheet.visible);
    owners.sheet.userData.navigation=true;const material=owners.sheet.material,restore=bindXianfaqiaoSourceWater(active,{terrain,water});
    assert(!bridgeSheet.visible&&!owners.sheet.visible);assert.equal(owners.sheet.userData.navigation,false);assert(owners.bed.visible&&owners.jet.visible&&owners.otherSheet.visible);
    assert.equal(owners.sheet.material,material);assert.equal(owners.released,0);assert.throws(()=>bindXianfaqiaoSourceWater(active,{terrain,water}),/already bound/);
    restore();restore();assert(bridgeSheet.visible&&owners.sheet.visible);assert.equal(owners.sheet.userData.navigation,true);assert(!Object.hasOwn(bridgeSheet.userData,'navigation'));
  }finally{water.dispose();}
});

test('missing or ambiguous source water fails before mutating either peer, preserving all borrowed owners',()=>{
  const local=fixtureOwners();try{
    const lake=local.peer.owner.group.getObjectByName('xieqiqu-south-lake-foreground');lake.add(local.sheet.clone());
    assert.throws(()=>activeWith(local),/Expected one source surface/);assert(local.sheet.visible);assert.equal(local.released,0);
  }finally{local.dispose();}
});

test('source support disposal between admission and water handoff cannot hide the last valid original water',()=>{
  const local=fixtureOwners(),water=waterOwner();try{
    const token=activeWith(local);local.peer.support.dispose();
    assert.throws(()=>bindXianfaqiaoSourceWater(token,{terrain,water}),/actual source triangle support/);
    assert(local.sheet.visible);assert.equal(local.released,0);
  }finally{water.dispose();local.dispose();}
});

function refusedHandoff(args){
  let restore;
  try{assert.throws(()=>{restore=bindXianfaqiaoSourceWater(active,args);});}
  finally{restore?.();}
}
test('a matching water label without the actual excavated court cannot remove source water',()=>{
  const water=waterOwner();
  try{refusedHandoff({terrain:{...terrain,courtFootprints:[]},water});assert(owners.sheet.visible);}
  finally{water.dispose();}
});
test('an unrelated visible water triangle at 3.8 m cannot stand in for the complete connected lake',()=>{
  const water=waterOwner(),mesh=water.sheets[water.snapshot().sheets.findIndex(s=>s.height===3.8)],original=mesh.geometry;
  const wrong=new THREE.PlaneGeometry(1,1);mesh.geometry=wrong;
  try{refusedHandoff({terrain,water});assert(owners.sheet.visible);}
  finally{mesh.geometry=original;wrong.dispose();water.dispose();}
});
test('a non-finite retained root matrix is rejected before any landscape mutation',()=>{
  const group=owners.bridge.owner.group,old=group.position.x;
  group.position.x=NaN;
  try{assert.throws(()=>activeWith(owners),/transform/);}
  finally{group.position.x=old;group.updateMatrixWorld(true);}
});

test('explicit composition review accepts the existing Xieqiqu factory identity while all admission flags remain false',()=>{
  const local=fixtureOwners(),review=candidate.compositionReview.admission;
  try{
    delete local.peer.owner.archive;
    local.peer.owner.group.userData.assetId='xieqiqu-complete-group';
    local.peer.owner.diagnostics={assetId:'xieqiqu-complete-group',fixtureOnly:true};
    const token=activateXianfaqiaoSitePatch(candidate,{admission:review,bridge:local.bridge,peer:local.peer});
    assert.equal(token.active,true);assert.equal(token.admission.nativeApproved,false);assert.equal(token.admission.composedWorldApproved,false);
    assert.equal(candidate.active,false);assert.equal(candidate.compositionReview.enabled,false);assert.equal(candidate.compositionReview.route.enabled,false);
    const result=createMuseumLandscape({sites:[candidate.peerSite],readyAssetIds:['xieqiqu'],xianfaqiaoPatch:token});
    assert.equal(result.courts.length,3);assert.equal(result.pads.length,4);assert.equal(result.paths.length,2);
    assert.equal(result.sitePatches[0].admission.mode,'composition-review');assert.equal(local.released,0);
    for(const bad of [{...review,nativeApproved:true},{...review,composedWorldApproved:true},{...review,manifestSHA256:'a'.repeat(64)},{...review,glbSHA256:'a'.repeat(64)}])
      assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission:bad,bridge:local.bridge,peer:local.peer}),/review|admission/);
    assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission,bridge:local.bridge,peer:local.peer}),/archive or explicit review source/);
    local.peer.owner.diagnostics.assetId='a-named-part';
    assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission:review,bridge:local.bridge,peer:local.peer}),/retained full/);
  }finally{local.dispose();}
});

test('same-plan readiness requires the reused Xieqiqu pad and both authored pool cuts before terrain is constructed',()=>{
  const original=createMuseumLandscape({sites:[candidate.peerSite],readyAssetIds:['xieqiqu']}),before=JSON.stringify(original);
  for(const wrong of [{...original,pads:[]},{...original,pads:original.pads.map(p=>({...p,heightY:4}))}])assert.throws(()=>applyXianfaqiaoSitePatch(wrong,active),/same-plan Xieqiqu court pad/);
  for(const wrong of [{...original,courts:original.courts.slice(0,1)},{...original,courts:original.courts.map((c,i)=>i?{...c,water:{...c.water,surfaceY:3.8}}:c)}])assert.throws(()=>applyXianfaqiaoSitePatch(wrong,active),/both matching Xieqiqu/);
  assert.equal(JSON.stringify(original),before);
  assert.deepEqual(candidate.peerGround.pads,original.pads);assert.deepEqual(candidate.peerGround.courts,original.courts);
});

test('real flower voids remain open above soil and stone floors; courtyard and approach soil cannot cover the original paving',()=>{
  const land=terrain.group.getObjectByName('yuanming-continuous-land'),down=new THREE.Vector3(0,-1,0);let dry=0;
  for(const [i,z] of [-539,-592].entries()){
    const ray=new THREE.Raycaster(new THREE.Vector3(395,6,z),down),hit=terrain.surfaceAt(395,z);
    assert.equal(ray.intersectObject(owners.paving).length,0);assert.equal(ray.intersectObject(land).length,0);
    near(ray.intersectObject(owners.flowerBeds[i])[0].point.y,3.55);near(hit.height,3.32);near(hit.waterY,4.13);assert.equal(hit.walkable,false);
    const combined=museumSupport(hit,owners.peer.support.surfaceAt(395,z,{maxY:3.6}));assert.equal(combined.walkable,false);near(combined.height,3.55);
  }
  for(let z=-612;z<=-526;z+=2.5)for(let x=345;x<=445;x+=2.5){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,4.02,z),down,0,2),paving=ray.intersectObject(owners.paving)[0];if(!paving)continue;
    const soil=ray.intersectObject(land)[0];if(!soil)continue;
    assert(soil.point.y<=paving.point.y-.019,`soil ${soil.point.y} covers paving ${paving.point.y} at ${x},${z}`);dry++;
  }
  assert(dry>1000);stats.peerDryPavingQueries=dry;
});

test('the foreground handoff and existing two-pool handoff are independent and retain both stone floors and all other water',()=>{
  const water=waterOwner();let restorePools,restoreLake;
  try{
    restorePools=bindXieqiquFountainWater(candidate.peerGround,{owner:owners.peer.owner,terrain,water});
    assert(owners.flowerSheets.every(m=>!m.visible));assert(owners.sheet.visible);
    restoreLake=bindXianfaqiaoSourceWater(active,{terrain,water});assert(!owners.sheet.visible);
    assert(owners.flowerBeds.every(m=>m.visible));assert(owners.bed.visible&&owners.jet.visible&&owners.otherSheet.visible);
    restoreLake();assert(owners.sheet.visible);assert(owners.flowerSheets.every(m=>!m.visible));
    restorePools();assert(owners.flowerSheets.every(m=>m.visible));assert.equal(owners.released,0);
  }finally{restoreLake?.();restorePools?.();water.dispose();}
});

test('a missing live peer pool or changed connected cut/wet mask fails before source visibility changes',()=>{
  const water=waterOwner(),court=active.prepared.courts[0];
  try{
    for(const changed of [{floorY:2.9},{rimY:4.1},{rimBlend:0},{water:{...court.water,polygon:rect(0,0,1,1)}}]){
      const courts=terrain.courtFootprints.map(c=>c.id===court.id?{...c,...changed}:c);refusedHandoff({terrain:{...terrain,courtFootprints:courts},water});
    }
    refusedHandoff({terrain:{...terrain,courtFootprints:terrain.courtFootprints.filter(c=>c.id!==candidate.peerGround.courts[0].id)},water});assert(owners.sheet.visible);
  }finally{water.dispose();}
});

test('draw-range loss, a moved water mesh and a falsified plane snapshot cannot pass the actual water-triangle handoff',()=>{
  const water=waterOwner(),i=water.snapshot().sheets.findIndex(s=>s.height===3.8),sheet=water.sheets[i];
  try{
    sheet.geometry.setDrawRange(0,3);refusedHandoff({terrain,water});sheet.geometry.setDrawRange(0,Infinity);
    sheet.position.x=.02;refusedHandoff({terrain,water});sheet.position.x=0;
    const old=sheet.position.y;sheet.position.y=old+.1;const snapshot=water.snapshot();snapshot.sheets[i].planeY+=.1;
    refusedHandoff({terrain,water:{...water,snapshot:()=>snapshot}});sheet.position.y=old;
    assert(owners.sheet.visible);
  }finally{water.dispose();}
});

test('a changed source sheet or a detached display copy fails before the original sheets are hidden',()=>{
  const local=fixtureOwners(),review=candidate.compositionReview.admission;
  try{
    const y=local.sheet.position.y;local.sheet.position.y+=.03;
    assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission:review,bridge:local.bridge,peer:local.peer}),/Source water plane/);
    local.sheet.position.y=y;local.peer.owner.collisionGroup=new THREE.Group();
    assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission:review,bridge:local.bridge,peer:local.peer}),/separately batched/);
    assert(local.sheet.visible);assert.equal(local.released,0);
  }finally{local.dispose();}
});

test('a second-sheet mutation failure rolls back the first sheet and permits a clean retry',()=>{
  const local=fixtureOwners(),water=waterOwner(),token=activeWith(local),node=local.sheet,original=node.userData;
  try{
    node.userData=Object.freeze({...original});assert.throws(()=>bindXianfaqiaoSourceWater(token,{terrain,water}),/read only|extensible|rollback/);
    const first=local.bridge.owner.group.getObjectByName('xianfaqiao-study-water-channel').children.find(m=>m.material?.userData?.role==='surface');
    assert(first.visible&&node.visible);assert(!Object.hasOwn(first.userData,'navigation'));assert.equal(local.released,0);
    node.userData=original;const restore=bindXianfaqiaoSourceWater(token,{terrain,water});assert(!first.visible&&!node.visible);restore();restore();assert(first.visible&&node.visible);
  }finally{node.userData=original;water.dispose();local.dispose();}
});

test('restoration continues after one property fails and does not retain an active binding or dispose borrowed owners',()=>{
  const local=fixtureOwners(),water=waterOwner(),token=activeWith(local);let restore,first;
  try{
    restore=bindXianfaqiaoSourceWater(token,{terrain,water});first=local.bridge.owner.group.getObjectByName('xianfaqiao-study-water-channel').children.find(m=>m.material?.userData?.role==='surface');
    Object.defineProperty(first,'visible',{configurable:true,get:()=>false,set:()=>{throw new Error('test visibility restoration fault');}});
    assert.throws(restore,/restoration failed/);assert(local.sheet.visible);assert(!Object.hasOwn(local.sheet.userData,'navigation'));assert.equal(local.released,0);
    Object.defineProperty(first,'visible',{configurable:true,writable:true,value:true});restore();
    const again=bindXianfaqiaoSourceWater(token,{terrain,water});again();assert(first.visible&&local.sheet.visible);
  }finally{if(first)Object.defineProperty(first,'visible',{configurable:true,writable:true,value:true});restore?.();water.dispose();local.dispose();}
});

test('a second activation token cannot take an independent restoration snapshot of the same hidden source sheets',()=>{
  const water=waterOwner(),other=activeWith(owners);let restore,unexpected;
  try{
    restore=bindXianfaqiaoSourceWater(active,{terrain,water});assert(!owners.sheet.visible);
    assert.throws(()=>{unexpected=bindXianfaqiaoSourceWater(other,{terrain,water});},/already bound/);
    restore();restore=null;assert(owners.sheet.visible);
    const next=bindXianfaqiaoSourceWater(other,{terrain,water});next();assert(owners.sheet.visible);
  }finally{unexpected?.();restore?.();water.dispose();}
});

test('existing persistent ensemble records directly activate the patch and keep real support across leave/return',async()=>{
  const local=fixtureOwners({buildSupport:false}),root=new THREE.Group(),loaded=[],water=waterOwner();let restore,query;
  const ensemble=createPersistentEnsemble({root,descriptors:[candidate.peerSite,candidate.site],
    load:async descriptor=>{loaded.push(descriptor.id);return descriptor.id==='xieqiqu'?local.peer.owner:local.bridge.owner;},
    place:(owner,descriptor)=>placed(owner.group,descriptor)});
  try{
    await ensemble.prepare();assert.deepEqual(loaded,['xieqiqu','xianfaqiao']);
    const bridge=ensemble.get('xianfaqiao'),peer=ensemble.get('xieqiqu');
    const token=activateXianfaqiaoSitePatch(candidate,{admission:candidate.compositionReview.admission,bridge,peer});
    const plan=createMuseumLandscape({sites:[candidate.peerSite],readyAssetIds:['xieqiqu'],xianfaqiaoPatch:token});assert.equal(plan.courts.length,3);
    restore=bindXianfaqiaoSourceWater(token,{terrain,water});assert(!local.sheet.visible);
    for(const id of ['xianfaqiao','xieqiqu','xianfaqiao']){const owner=await ensemble.borrow(id);assert.equal(owner,ensemble.get(id).owner);ensemble.release(owner);}
    assert.deepEqual(loaded,['xieqiqu','xianfaqiao']);assert.equal(local.released,0);
    query=ensemble.support.createGuideSupport({minX:329,maxX:350,minZ:-570,maxZ:-469});
    for(const [x,z,y] of [[334.75,-518.62,5.77],[347,-566.77,4]])near(query.surfaceAt(x,z,{maxY:y+.02}).height,y);
    query.dispose();query=null;assert.equal(bridge.support.disposed,false);assert.equal(peer.support.disposed,false);
    restore();restore=null;assert(local.sheet.visible);ensemble.dispose();ensemble.dispose();assert.equal(local.released,1);assert.equal(bridge.support.disposed,true);assert.equal(peer.support.disposed,true);assert.equal(root.children.length,0);
  }finally{query?.dispose();restore?.();water.dispose();ensemble.dispose();}
});


test('R3 decorations retain the actual full source owner only for explicit composition review',()=>{
  const local=fixtureOwners(),review=candidate.compositionReview.admission,original=local.peer.owner;
  delete original.archive;original.group.userData.assetId='xieqiqu-complete-group';
  original.diagnostics={assetId:'xieqiqu-complete-group'};
  let invalid=false,checks=0;
  original.assertCurrent=()=>{if(invalid)throw new Error('changed court source');return true;};
  const decorated={group:original.group,reviewSourceOwner:original,dispose(){original.dispose();},
    diagnostics:{assetId:'xieqiqu-r9-fish-integration-r1',assemblyId:'xieqiqu-court-garden-composition-r3-candidate',
      publicAdmission:false,historicalLayoutVerified:false},
    assertCurrent(){checks++;return original.assertCurrent();},
  };
  const activate=owner=>activateXianfaqiaoSitePatch(candidate,{admission:review,bridge:local.bridge,peer:{...local.peer,owner}});
  try{
    const token=activate(decorated);assert.equal(checks,1);assert.equal(token.admission.nativeApproved,false);
    assert.equal(decorated.diagnostics.assetId,'xieqiqu-r9-fish-integration-r1');
    assert.equal(original.diagnostics.assetId,'xieqiqu-complete-group');assert.equal(decorated.archive,undefined);
    for(const source of [undefined,decorated,{...original,group:new THREE.Group()},{...original,disposed:true},
      {...original,archive:{id:'xieqiqu',glbSHA256:'c'.repeat(64)}},{...original,diagnostics:{assetId:'cropped-court'}},
      {...original,assertCurrent:undefined}]){
      assert.throws(()=>activate({...decorated,reviewSourceOwner:source}),/explicit review source owner/);
    }
    for(const altered of [{assemblyId:'unknown-wrapper'},{assetId:'xieqiqu-r9-pool-only'},
      {publicAdmission:true},{historicalLayoutVerified:true}]){
      assert.throws(()=>activate({...decorated,diagnostics:{...decorated.diagnostics,...altered}}),/explicit review source owner/);
    }
    assert.throws(()=>activateXianfaqiaoSitePatch(candidate,{admission,bridge:local.bridge,
      peer:{...local.peer,owner:decorated}}),/explicit review source owner/);
    invalid=true;
    assert.throws(()=>createMuseumLandscape({sites:[],xianfaqiaoPatch:token}),/changed court source/);
    assert(local.sheet.visible);assert.equal(local.released,0);
  }finally{local.dispose();}
});
