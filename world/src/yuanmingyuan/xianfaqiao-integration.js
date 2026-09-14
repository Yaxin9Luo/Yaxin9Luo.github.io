import {gardenLayout,pointInPolygon} from './garden-layout.js';
import {museumSite,sitePoint} from './museum-sites.js';

// Metadata for the existing full archive; this module imports no model factory.
// Every metric below is an authored model dimension, not a historical survey.
export const xianfaqiaoArchive=Object.freeze({
  assetId:'xianfaqiao',sourceAssetId:'xianfaqiao-study',
  manifestURL:'/assets/yuanmingyuan/xianfaqiao/025c4c9cf8743511-gzip-bin-v2/manifest.json',
  manifestSHA256:'c8cd216c8693eea351f2f07f9c20ebbaffd46678091678fa1ac6c28ad973f4fc',manifestBytes:7677,
  sourceDigest:'025c4c9cf874351128bbe922616fd495b35acd9fe5ef58f5ba4275533edeb869',
  glbSHA256:'bdd58e322b6916e581906ace46426eb4980a338b9b83245ba9b0858ee66e24e2',
  runtimeSHA256:'89ff32710535c2c0e36e029af6761232ef8dc626bda9431d1a862556470f2a60',
  triangles:389632,storedTriangles:389632,meshes:34,geometries:34,materials:8,textures:2,instances:0,nodes:54,
  // The later transport comparison is separate from the immutable export-time
  // candidate manifest. It does not approve world placement or navigation.
  nativeApproved:false,
  transportReview:Object.freeze({status:'passed',scope:'static-daylight-source-archive-visual-comparison',
    report:'work/yuanmingyuan/xianfaqiao-native-archive-r1/review.md',sourceSnapshot:'c31bdc6eed7157b6',
    views:Object.freeze(['front','threequarter','deck-join-positive','deck-join-negative','sluice','passage']),
    nightReviewed:false,motionReviewed:false,composedWorldReviewed:false,walkingReviewed:false}),
});

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const xyz=(site,p)=>{const q=sitePoint(site,p),result=[q.x,q.y,q.z];if(!result.every(Number.isFinite))throw new Error('Xianfaqiao placement overflows finite world coordinates');return result;};
const polygon=(site,ring)=>ring.map(([x,z])=>{const q=xyz(site,[x,0,z]);return[q[0],q[2]];});
const level=(site,y)=>xyz(site,[0,y,0])[1];
function validateSite(site){
  if(site?.id!=='xieqiqu'||!Array.isArray(site.position)||site.position.length!==3||!site.position.every(Number.isFinite)||!Number.isFinite(site.rotationY)||!Number.isFinite(site.scale)||site.scale<=0)throw new Error('Xianfaqiao placement requires the actual finite Xieqiqu site transform with positive uniform scale');
}
function path(id,from,to,width){
  const dx=to[0]-from[0],dz=to[2]-from[2],length=Math.hypot(dx,dz),nx=-dz/length*width/2,nz=dx/length*width/2;
  if(![length,width,nx,nz].every(Number.isFinite)||length<=0||width<=0)throw new Error('Xianfaqiao approach must have finite nonzero length and width');
  return {id,from,to,width,thickness:.32,grade:Math.abs(to[1]-from[1])/length,
    polygon:[[from[0]-nx,from[2]-nz],[to[0]-nx,to[2]-nz],[to[0]+nx,to[2]+nz],[from[0]+nx,from[2]+nz]],
    kind:'exhibition-ground-path',evidence:'exhibition-design',coordinatesSurveyed:false,built:false};
}

/** A review proposal, never an admission or terrain mutation. It keeps the
 * source lake datum and reports the coarse garden-boundary conflict explicitly. */
export function createXianfaqiaoIntegrationDescriptor({xieqiquSite=museumSite('xieqiqu'),layout=gardenLayout}={}){
  validateSite(xieqiquSite);
  const peer=xieqiquSite,waterY=-.20,bridgeWaterY=-.72,deckY=1.25;
  // Xieqiqu has a cropped foreground lake: x ±52, z 40.755…52.005.
  // Join the bridge study's east water edge (+local Z=10) to its west edge.
  const site={id:'xianfaqiao',assetId:'xianfaqiao',entryId:'xianfaqiao',region:'changchunyuan',position:xyz(peer,[-62,waterY-bridgeWaterY,46.38]),rotationY:peer.rotationY+Math.PI/2,scale:peer.scale,evidence:'author-placement-from-existing-model-edges',coordinatesSurveyed:false};
  const wet=polygon(site,rect(-16.1,-10,16.1,10)),excavation=polygon(site,rect(-16.2,-10,16.2,10));
  const receiver=polygon(peer,rect(-52,40.755,52,52.005));
  const northEnd=xyz(site,[18.15,deckY,1.75]),southEnd=xyz(site,[-18.15,deckY,1.75]);
  const northFoot=xyz(peer,[-48,0,-1.77]),southFoot=xyz(peer,[-60.25,0,94.53]);
  const paths=[path('xianfaqiao-north-court-approach',northFoot,northEnd,1.4*site.scale),path('xianfaqiao-south-bank-approach',southEnd,southFoot,1.4*site.scale)];
  // A buried solid ramp reaches the ordinary ground even at its high end;
  // a thin sloping slab alone would hang in the air above the low court.
  for(const p of paths){p.thickness=p.thickness*site.scale+Math.abs(p.to[1]-p.from[1]);p.undersideMaximumY=Math.min(p.from[1],p.to[1])-.32*site.scale;}
  const boundary=layout?.gardens?.find(g=>g.id==='changchunyuan')?.boundary;
  if(!Array.isArray(boundary)||boundary.length<3||boundary.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new Error('Xianfaqiao placement requires the Changchunyuan garden boundary for conflict reporting');
  const footprint=polygon(site,rect(-18.2,-10,18.2,10));
  const outside=footprint.filter(p=>!pointInPolygon(p,boundary));
  const alignment={kind:'unreviewed-model-alignment-proposal',assetId:'xianfaqiao',metresCalibrated:false};
  return {
    id:'xianfaqiao-integration-proposal-v1',status:'requires-native-and-landscape-review',site,archive:{...xianfaqiaoArchive},
    identities:{assetId:'xianfaqiao',archiveSourceAssetId:'xianfaqiao-study',proposedGroupId:'xianfaqiao',museumEntryId:'xianfaqiao',registeredGroupId:null},
    admission:{nativeApproved:false,composedWorldApproved:false,activate:false},
    evidence:{topology:'west bank of the lake in front of Xieqiqu; separate from Xianfashan',
      institutionalResearch:'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html',
      catalogue:'https://www.nlc.cn/migrated/www.nlc.cn/newhxjy/wjsy/wjls/wjqcsy/wjd20q/d20qysltdjs/201011/P020101123721209322961.pdf',
      catalogueLocator:'printed p.50; 1961 Jin Xun retrospective album, first listed view',
      contextualImage:'/images/yuanmingyuan/xieqiqu-south.jpg',imageScope:'left-edge context in the south-view engraving; not a complete bridge elevation',
      originalSurvey:false,imageCoordinateFit:false,measuredControlPoints:[],reportedHistoricMetreDimensions:[],
      orientation:'Authored reading: the decorated front faces the forelake to the east, with the bridge span running north–south. No surveyed compass bearing is asserted.'},
    water:{surfaceY:level(site,bridgeWaterY),bridge:{sourceGroup:'xianfaqiao-study-water-channel',polygon:wet,bedTopY:level(site,-1.70)},
      receivingLake:{sourceAssetId:'xieqiqu',sourceGroup:'xieqiqu-south-lake-foreground',registeredWaterId:null,polygon:receiver,surfaceY:level(peer,waterY),bedTopY:level(peer,-.85),extent:'cropped study water, not the full historical forelake'},
      contactEdge:[xyz(peer,[-52,waterY,40.755]),xyz(peer,[-52,waterY,52.005])],
      hydraulicDirection:'unestablished',connectionToGlobalLakeY2:'unestablished; do not snap this lake to the world lake datum',
      replacement:'Keep both source water sheets until a composed water owner is ready; then hide only their water-category meshes, retaining the stone beds and all other original geometry.'},
    prepared:{activate:false,requiredOwners:['xianfaqiao','xieqiqu'],courts:[{id:'xianfaqiao-channel-excavation',assetId:'xianfaqiao',sourceGroup:'xianfaqiao-study-water-channel',polygon:excavation,floorY:level(site,-1.84),rimY:level(peer,0),alignment,
      water:{polygon:wet,surfacePolygon:wet,surfaceY:level(site,bridgeWaterY),kind:'ornamental-basin',sourceIds:['xianfaqiao-authored-study']}},
      {id:'xieqiqu-forelake-excavation-for-bridge',assetId:'xieqiqu',sourceGroup:'xieqiqu-south-lake-foreground',polygon:receiver,floorY:level(peer,-.98),rimY:level(peer,0),alignment:{...alignment,assetId:'xieqiqu'},
        water:{polygon:receiver,surfacePolygon:receiver,surfaceY:level(peer,waterY),kind:'ornamental-basin',sourceIds:['xieqiqu-authored-study']}}],paths,
      terrainContract:'Requires the static assetCourts water interface; the current dry-land replacement API cannot add this water surface. Prepare the receiving Xieqiqu lake and bank geometry in the same commit.'},
    support:{mode:'actual-source-and-approach-triangles',sourceGroups:['xianfaqiao-five-opening-sluice','xianfaqiao-study-grounded-abutments'],deckY:level(site,deckY),peerCourtY:level(peer,0),riseAboveCourt:(deckY+waterY-bridgeWaterY)*site.scale,
      spanAxis:'local X',throughDoorAxis:'local Z',endpoints:{north:northEnd,south:southEnd},
      lanes:[{id:'forelake-lane',from:xyz(site,[-18.15,deckY,1.75]),to:xyz(site,[18.15,deckY,1.75]),candidateWidth:1.4*site.scale},{id:'rear-lane',from:xyz(site,[-18.15,deckY,-1.75]),to:xyz(site,[18.15,deckY,-1.75]),candidateWidth:1.4*site.scale}],
      door:{center:xyz(site,[0,deckY,0]),clearWidth:2.25*site.scale,springAboveDeck:(3.91-deckY)*site.scale,gateGroup:'xianfaqiao-european-screen-and-central-gate'},
      arches:[-10.5,-5.25,0,5.25,10.5].map(x=>({waterPoint:xyz(site,[x,bridgeWaterY,0]),clearSpan:3.70*site.scale,crownY:level(site,.50),springY:level(site,-.74)})),
      analyticHeightIsNotNavigation:true,fullOrnamentCollisionReviewPending:true,
      rule:'Both raised approaches must be built and tested against original triangles before visit is enabled. The gate is a cross-passage between two deck lanes; continuing beyond the deck along local Z enters water.'},
    visitorEntry:{position:northFoot,source:'existing Xieqiqu court near its west edge',routeId:paths[0].id,enabled:false},
    compositionReview:{enabled:false,scope:'explicit-modern-exhibition-site-review',
      admission:{mode:'composition-review',manifestSHA256:xianfaqiaoArchive.manifestSHA256,glbSHA256:xianfaqiaoArchive.glbSHA256,nativeApproved:false,composedWorldApproved:false},
      views:[
        ['xianfaqiao-xieqiqu-overview',[-90,28,17],[-28,1,35]],
        ['xianfaqiao-north-join',[-67,5.3,22],[-60.25,1.77,28.23]],
        ['xianfaqiao-south-join',[-54,5.3,69],[-60.25,1.77,64.53]],
        ['xianfaqiao-water-connection',[-48,1.2,40],[-57,-.2,46.38]],
      ].map(([id,position,target])=>({id,position:xyz(peer,position),target:xyz(peer,target),space:'world',nativeReviewed:false})),
      route:{id:'xianfaqiao-court-deck-bank-review',points:[northFoot,northEnd,southEnd,southFoot],pathIds:paths.map(p=>p.id),laneId:'forelake-lane',
        candidateWidth:1.4*site.scale,maximumApproachGrade:Math.max(...paths.map(p=>p.grade)),enabled:false,
        rule:'Review waypoints only. Landing and every walking/turning step must query the retained source and terrain triangles; these heights are not a navigation override.'}},
    conflicts:{outsideChangchunyuanCorners:outside,existingPeerCourtWestEdge:[xyz(peer,[-52,0,-51]),xyz(peer,[-52,0,40.75])],
      boundaryResolution:'Do not shift the bridge east into the forecourt or assign it to the eastern hill to conceal this coarse-layout conflict. ROOT must review the western parcel boundary and Xieqiqu setting together.'},
    blockers:['composed-world-day-night-and-walking-review-pending','bridge-group-not-registered','forelake-not-registered-in-world-water','raised-bank-approaches-not-built','source-ornament-collision-not-checked',...(outside.length?['coarse-changchunyuan-boundary-conflict']:[])],
  };
}
