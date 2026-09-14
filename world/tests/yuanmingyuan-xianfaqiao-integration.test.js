import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createXianfaqiaoIntegrationDescriptor,xianfaqiaoArchive} from '../src/yuanmingyuan/xianfaqiao-integration.js';
import {museumEntry,museumImages,guideSign} from '../src/yuanmingyuan/museum-content.js';
import {gardenLayout,pointInPolygon,waterAt} from '../src/yuanmingyuan/garden-layout.js';
import {museumSite,sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {GardenGateBuilder} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {BRIDGE,fiveSluiceWallGeometry,bridgeScreenGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {addXianfaqiaoDeck,addXianfaqiaoAbutment} from '../src/yuanmingyuan/xianfaqiao-deck-joins.js';
import {assertClosedWinding} from './yuanmingyuan-garden-study-checks.js';

const near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
function componentFixture(){
  // Actual shared source primitives and exact source box parameters. Deliberately
  // no complete factory, sculptural decoration, archive decode or GPU allocation.
  const b=new GardenGateBuilder('xianfaqiao-contact-fixture'),group=new THREE.Group();
  try{
    const base=new THREE.Group();base.name='xianfaqiao-five-opening-sluice';group.add(base);
    b.add(base,fiveSluiceWallGeometry(),b.m.wetStone);
    addXianfaqiaoDeck(b,base);
    const gate=new THREE.Group();gate.name='xianfaqiao-european-screen-and-central-gate';group.add(gate);b.add(gate,bridgeScreenGeometry(),b.m.plaster);
    const banks=new THREE.Group();banks.name='xianfaqiao-study-grounded-abutments';group.add(banks);
    for(const side of [-1,1])addXianfaqiaoAbutment(b,banks,base,side);
    return b.finish(group,{assetId:'contact-fixture'});
  }catch(error){b.dispose();throw error;}
}
function localRay(group,origin,direction,far){
  group.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(...origin).applyMatrix4(group.matrixWorld),new THREE.Vector3(...direction).transformDirection(group.matrixWorld),0,far*group.scale.x).intersectObject(group,true);
}
function place(group,site){group.position.fromArray(site.position);group.rotation.y=site.rotationY;group.scale.setScalar(site.scale);group.updateMatrixWorld(true);}

test('the bridge has its own bilingual exhibit and stays outside the unapproved site catalogue',()=>{
  const entry=museumEntry('xianfaqiao'),sign=guideSign('xianfaqiao');assert(entry);
  assert.equal(entry.region,'changchunyuan');assert.match(entry.lead.zh,/前湖西岸/);assert.match(entry.lead.en,/west bank/);
  assert.match(entry.note.zh,/1961/);assert.match(entry.note.en,/retrospective/);assert.match(entry.note.en,/awaits native review/);
  assert(sign.zh.includes('线法桥'));assert(sign.en.includes('Xianfaqiao'));
  assert.deepEqual(entry.images,['xieqiquSouth']);assert.equal(museumImages.xieqiquSouth.kind,'historic-engraving');
  assert.equal(museumSite('xianfaqiao'),null);
});

test('the proposal binds the reviewed new manifest identity and all actual counts without admitting the world',async()=>{
  const d=createXianfaqiaoIntegrationDescriptor(),bytes=await readFile(new URL('../public'+xianfaqiaoArchive.manifestURL,import.meta.url)),m=JSON.parse(bytes);
  assert.equal(d.archive.manifestURL,'/assets/yuanmingyuan/xianfaqiao/025c4c9cf8743511-gzip-bin-v2/manifest.json');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),d.archive.manifestSHA256);
  assert.equal(bytes.length,d.archive.manifestBytes);assert.equal(m.id,d.archive.assetId);
  assert.equal(m.sourceDigest,d.archive.sourceDigest);assert.equal(m.glb.sha256,d.archive.glbSHA256);assert.equal(m.runtime.sha256,d.archive.runtimeSHA256);
  assert.equal(m.verification.counts.triangles,389632);
  for(const key of ['triangles','storedTriangles','meshes','geometries','materials','textures','instances','nodes'])assert.equal(d.archive[key],m.verification.counts[key],key);
  assert.equal(d.identities.archiveSourceAssetId,'xianfaqiao-study');assert.equal(d.identities.registeredGroupId,null);
  assert.equal(d.admission.activate,false);assert.equal(d.admission.nativeApproved,false);assert.equal(d.admission.composedWorldApproved,false);assert.equal(d.prepared.activate,false);
  assert.equal(d.evidence.originalSurvey,false);assert.equal(d.evidence.imageCoordinateFit,false);assert.deepEqual(d.evidence.reportedHistoricMetreDimensions,[]);
  assert.equal(d.water.receivingLake.registeredWaterId,null);assert.equal(d.visitorEntry.enabled,false);
});

test('transport-only visual review cannot enable scene, night or walking admission',async()=>{
  const d=createXianfaqiaoIntegrationDescriptor(),review=d.archive.transportReview;
  assert(review);assert.equal(review.status,'passed');assert.equal(review.scope,'static-daylight-source-archive-visual-comparison');
  assert.equal(review.report,'work/yuanmingyuan/xianfaqiao-native-archive-r1/review.md');assert.equal(review.sourceSnapshot,'c31bdc6eed7157b6');
  assert.deepEqual(review.views,['front','threequarter','deck-join-positive','deck-join-negative','sluice','passage']);
  for(const key of ['nightReviewed','motionReviewed','composedWorldReviewed','walkingReviewed'])assert.equal(review[key],false,key);
  assert.equal(d.archive.nativeApproved,false);assert.deepEqual(d.admission,{nativeApproved:false,composedWorldApproved:false,activate:false});assert.equal(d.prepared.activate,false);assert.equal(d.visitorEntry.enabled,false);
  assert(Object.isFrozen(xianfaqiaoArchive));assert(Object.isFrozen(review));assert(Object.isFrozen(review.views));
  const manifest=JSON.parse(await readFile(new URL('../public'+d.archive.manifestURL,import.meta.url)));
  assert.equal(manifest.nativeArchiveVisualReview,false,'the export-time candidate manifest remains immutable; the later transport review is separate evidence');
});

test('composition-review waypoints and cameras are explicit world data and grant no world or walking approval',()=>{
  const d=createXianfaqiaoIntegrationDescriptor(),review=d.compositionReview;
  assert.equal(review.enabled,false);assert.equal(review.admission.mode,'composition-review');assert.equal(review.admission.nativeApproved,false);assert.equal(review.admission.composedWorldApproved,false);
  assert.equal(review.admission.manifestSHA256,xianfaqiaoArchive.manifestSHA256);assert.equal(review.admission.glbSHA256,xianfaqiaoArchive.glbSHA256);
  assert.equal(review.route.enabled,false);assert.deepEqual(review.route.points,[d.visitorEntry.position,d.support.endpoints.north,d.support.endpoints.south,d.prepared.paths[1].to]);
  assert(review.route.maximumApproachGrade<.06);assert.equal(review.route.candidateWidth,1.4);assert.equal(review.views.length,4);
  for(const view of review.views){assert.equal(view.space,'world');assert.equal(view.nativeReviewed,false);assert([...view.position,...view.target].every(Number.isFinite));assert(Math.hypot(...view.position.map((v,i)=>v-view.target[i]))>4);}
  const rotated={...museumSite('xieqiqu'),position:[100,7,-100],rotationY:.37,scale:1.5},r=createXianfaqiaoIntegrationDescriptor({xieqiquSite:rotated});
  near(r.compositionReview.route.maximumApproachGrade,review.route.maximumApproachGrade);near(r.compositionReview.route.candidateWidth,2.1);
  const camera=sitePoint(rotated,[-67,5.3,22]);r.compositionReview.views[1].position.forEach((v,i)=>near(v,[camera.x,camera.y,camera.z][i]));
  assert.throws(()=>createXianfaqiaoIntegrationDescriptor({xieqiquSite:{...museumSite('xieqiqu'),scale:Number.MAX_VALUE}}),/overflows/);
});

test('water alignment follows Xieqiqu’s actual 3.8 lake, with a truthful 1.77 rise and a shared west-shore edge',()=>{
  const d=createXianfaqiaoIntegrationDescriptor();
  d.site.position.forEach((value,i)=>near(value,[333,4.52,-518.62][i]));near(d.site.rotationY,Math.PI/2);
  near(d.water.surfaceY,3.8);near(d.water.surfaceY,d.water.receivingLake.surfaceY);near(d.support.deckY,5.77);near(d.support.riseAboveCourt,1.77);
  near(d.water.bridge.bedTopY,2.82);near(d.water.receivingLake.bedTopY,3.15);
  for(const point of d.water.contactEdge){near(point[0],343);near(point[1],3.8);assert(pointInPolygon([point[0],point[2]],d.water.bridge.polygon));assert(pointInPolygon([point[0],point[2]],d.water.receivingLake.polygon));}
  assert.equal(d.support.analyticHeightIsNotNavigation,true);
  assert.equal(d.conflicts.outsideChangchunyuanCorners.length,4);assert(d.blockers.includes('coarse-changchunyuan-boundary-conflict'));
  assert(d.site.position[0]<museumSite('xieqiqu').position[0]);assert(Math.abs(d.site.position[0]-925)>500);
});

test('a placed peer transform keeps both real water datums and the proposed ends aligned without mutating inputs',()=>{
  for(const peer of [{...museumSite('xieqiqu'),position:[17,6,-11],rotationY:.37,scale:1.5},{...museumSite('xieqiqu'),position:[-30,2,4],rotationY:-.63,scale:.75}]){
    const before=structuredClone(peer),d=createXianfaqiaoIntegrationDescriptor({xieqiquSite:peer});assert.deepEqual(peer,before);
    near(d.water.surfaceY,peer.position[1]-.2*peer.scale);near(d.water.surfaceY,d.water.receivingLake.surfaceY);
    near(d.support.deckY-d.water.surfaceY,(BRIDGE.deckY-BRIDGE.waterY)*peer.scale);
    near(d.support.riseAboveCourt,1.77*peer.scale);near(d.site.rotationY,peer.rotationY+Math.PI/2);
    for(const p of d.water.contactEdge)assert(pointInPolygon([p[0],p[2]],d.water.bridge.polygon));
  }
  for(const replacement of [null,{...museumSite('xieqiqu'),id:'xianfashan'},{...museumSite('xieqiqu'),scale:-1},{...museumSite('xieqiqu'),position:[NaN,0,0]}])assert.throws(()=>createXianfaqiaoIntegrationDescriptor({xieqiquSite:replacement}),/actual finite Xieqiqu/);
  assert.throws(()=>createXianfaqiaoIntegrationDescriptor({layout:{gardens:[]}}),/garden boundary/);
});

test('actual sluice and gateway primitives preserve five open waterways and a separate through-door after placement',()=>{
  const a=componentFixture(),d=createXianfaqiaoIntegrationDescriptor();place(a.group,d.site);
  try{
    for(const x of BRIDGE.pierX){assert.equal(localRay(a.group,[x,-.50,5],[0,0,-1],10).length,0);assert.equal(localRay(a.group,[x,-.50,-5],[0,0,1],10).length,0);}
    for(const x of [-.45,0,.45])for(const y of [1.6,2.7,3.2])assert.equal(localRay(a.group,[x,y,2.5],[0,0,-1],5).length,0);
    assert(localRay(a.group,[2.6,2.4,2.5],[0,0,-1],5).length>0);
    assert.equal(d.support.arches.length,5);near(d.support.arches[0].clearSpan,3.70);near(d.support.arches[0].crownY-d.water.surfaceY,1.22);
  }finally{a.dispose();}
});

test('actual deck and rounded abutments support both lane centers and the proposed joins without using an analytic substitute',()=>{
  const a=componentFixture(),d=createXianfaqiaoIntegrationDescriptor();place(a.group,d.site);
  try{
    for(let i=0;i<=120;i++)for(const z of [-1.75,1.75]){
      const x=-18.15+36.3*i/120,hits=localRay(a.group,[x,1.5,z],[0,-1,0],1);assert(hits.length);near(hits[0].point.y,d.support.deckY);
      assert(hits[0].face.normal.y>.99);
    }
    near(d.support.door.clearWidth,BRIDGE.clearDoor);near(d.support.door.springAboveDeck,2.66);
  }finally{a.dispose();}
});

test('the proposed bank ramps use dry model-space connections, stay below six percent and meet the existing court',()=>{
  const d=createXianfaqiaoIntegrationDescriptor(),peer=museumSite('xieqiqu');
  const court=rect(-52,-51,52,40.75).map(([x,z])=>{const p=sitePoint(peer,[x,0,z]);return[p.x,p.z];});
  assert(pointInPolygon([d.visitorEntry.position[0],d.visitorEntry.position[2]],court));
  for(const path of d.prepared.paths){
    assert(path.grade<.06);assert.equal(path.built,false);near(path.thickness,2.09);near(path.undersideMaximumY,3.68);
    const dx=path.to[0]-path.from[0],dz=path.to[2]-path.from[2],length=Math.hypot(dx,dz);
    for(let i=0;i<=100;i++)for(const side of [-.5,0,.5]){
      const t=i/100,x=path.from[0]+dx*t-dz/length*path.width*side,z=path.from[2]+dz*t+dx/length*path.width*side;
      assert.equal(waterAt(x,z),null,'the revised diagonal approach avoids the existing north-Fuhai waterway');
      for(const court of d.prepared.courts)assert.equal(pointInPolygon([x,z],court.polygon),false,'bank paths do not replace the water-spanning source bridge');
    }
  }
  near(d.prepared.paths[0].to[1],d.support.deckY);near(d.prepared.paths[1].from[1],d.support.deckY);
  assert.equal(waterAt(334.75,-566.82)?.id,'north-fuhai-waterway','the rejected straight northern approach remains documented');
});

test('small real terrain/path fixtures have closed ramp geometry and continuous source-to-bank support',()=>{
  const d=createXianfaqiaoIntegrationDescriptor(),a=componentFixture();place(a.group,d.site);
  const layout={id:'bridge-bank-fixture',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(300,-590,380,-450)}},gardens:[],waterBodies:[],ornamentalWaters:[],channels:[],islands:[],landforms:[],bridges:[]};
  let terrain;
  try{
    terrain=createGardenTerrain({layout,assetPaths:d.prepared.paths,detail:.2});
    for(const path of d.prepared.paths){
      const mesh=terrain.group.getObjectByName(`${path.id}-stone-path`);assert(mesh);assertClosedWinding(mesh.geometry);
      for(let i=1;i<100;i++){
        const t=i/100,x=path.from[0]+(path.to[0]-path.from[0])*t,z=path.from[2]+(path.to[2]-path.from[2])*t,expected=path.from[1]+(path.to[1]-path.from[1])*t;
        const hit=terrain.surfaceAt(x,z);assert.equal(hit.kind,'exhibition-ground-path');assert.equal(hit.walkable,true);near(hit.height,expected,1e-4);
      }
      const high=path.from[1]>path.to[1]?path.from:path.to;
      const original=new THREE.Raycaster(new THREE.Vector3(high[0],high[1]+.2,high[2]),new THREE.Vector3(0,-1,0)).intersectObject(a.group,true)[0];assert(original);near(original.point.y,high[1]);
      near(terrain.surfaceAt(high[0],high[2]).height,original.point.y,1e-4);
    }
  }finally{terrain?.dispose();a.dispose();}
});
