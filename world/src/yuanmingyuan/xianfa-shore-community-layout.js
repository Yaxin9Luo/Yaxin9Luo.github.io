// Contemporary exhibition planting. This frame follows the authored lake
// shoreline; neither the coordinates nor the species are a Qing survey.
export const xianfaShoreCommunitySpec = Object.freeze({
  id: 'xianfa-shore-community-r1',
  understoryFreeze: '136072fe80ebdfd9ddfa61e00a224f93b6625d7ce699d513143601df02018c7c',
  stoneFreeze: '0bf0b5c50cf2a8c380df4f5719ec3b88211f3974ef934b7f6f622a52f74bf933',
  sourceReview: 'work/yuanmingyuan/garden-understory-native-r2/review.json',
  sourceNativeTag: 'e28347566826b53a',
  artDirection: 'work/yuanmingyuan/xianfa-planting-art-direction-r1/planting-target.png',
  artDirectionKind: 'generated-contemporary-landscape-paintover-not-historical-evidence',
  triangleCounts: Object.freeze({ sedge: 59136, fern: 1023726, 'flower-shrub': 1588648, 'lake-rock': 241908 }),
  willowIds: Object.freeze(['willow-shore-changchun-great-lake-2-2', 'willow-shore-changchun-great-lake-2-3']),
});

const origin = [853.1562786319998, -554.839069658], tangent = [.9701425001453318, -.24253562503633427], inland = [-.24253562503633427, -.9701425001453318];
export function xianfaShoreWorldXZ(s, n) { return [origin[0] + s * tangent[0] + n * inland[0], origin[1] + s * tangent[1] + n * inland[1]]; }

/** Pure layout only: every new height is null until the current terrain is
 * queried. Overlapping leaf margins make drifts; separate root collars and two
 * complete water-view windows remain open. No mirrored or reduced source. */
export function createXianfaShoreCommunityLayout() {
  const placements = [], sizes = [.88, .96, .90, 1.02, .94, .86, .98, .91];
  const add = (species, sn, scale, drift) => {
    const number = placements.length + 1, [x,z] = xianfaShoreWorldXZ(...sn);
    placements.push({ id: `shore-${species}-${String(number).padStart(2, '0')}`, species, position: [x,null,z], shoreCoordinates: [...sn], yaw: number * 2.399963 % (Math.PI * 2), scale, drift, burial: .004, rootClearance: .05 });
  };
  const drifts = {
    'west-shore': [[-10.45,2.15],[-9.70,2.05],[-8.96,2.35],[-8.19,2.20],[-7.48,2.48],[-10.08,2.88],[-9.35,2.93],[-8.59,3.12],[-7.91,3.00],[-7.16,3.18]],
    'middle-shore': [[-1.82,2.40],[-1.08,2.06],[-.34,2.16],[.43,2.38],[1.18,2.11],[-1.48,3.07],[-.77,2.86],[.04,2.95],[.78,3.25],[1.50,2.90]],
    'east-shore': [[7.02,2.55],[7.78,2.26],[8.54,2.36],[9.27,2.54],[10.02,2.33],[7.34,3.25],[8.10,3.04],[8.90,3.25],[9.67,3.18],[10.38,3.01]],
    'west-upper-bank': [[-10.10,5.80],[-9.45,6.30],[-8.88,6.75],[-9.90,9.10],[-9.30,9.65],[-8.65,9.95],[-11.00,11.10],[-10.50,11.70],[-10.20,12.20]],
    'east-upper-bank': [[6.80,4.85],[6.20,5.20],[5.95,5.75],[6.25,9.30],[6.90,9.80],[7.55,10.15],[6.65,12.50],[6.05,13.02],[5.90,13.72]],
  };
  for (const [drift, points] of Object.entries(drifts)) for (const sn of points) add('sedge',sn,sizes[placements.length % sizes.length],drift);
  const ferns = [[-10.0,11.7],[-11.0,13.25],[-7.3,10.7],[6.3,13.3],[10.8,13.2],[10.2,15.1],[-5.9,7.2],[7.8,8.25]];
  ferns.forEach((sn,i)=>add('fern',sn,[.92,.85,.90,.86,.90,.83,.84,.92][i],i<3?'west-willow-shade':i<6?'east-willow-shade':'rock-companion'));
  [[-11,8.1],[-10.35,8.75],[11,9],[10.45,9.65]].forEach((sn,i)=>add('flower-shrub',sn,[.86,.94,.88,.92][i],i<2?'west-flower-accent':'east-flower-accent'));
  [[-7.1,5.3,.60,-.08,.20],[7.2,6.25,.46,.10,.14]].forEach(([s,n,scale,turn,burial],i)=>{
    const [x,z]=xianfaShoreWorldXZ(s,n);
    placements.push({id:`shore-rock-${i+1}`,species:'lake-rock',position:[x,null,z],shoreCoordinates:[s,n],scale,yaw:Math.atan2(tangent[0],tangent[1])+turn,pitchX:Math.PI/2,burial,drift:i?'east-recumbent-stone':'west-recumbent-stone',anchor:'oriented-actual-source-bounds-XZ-centre'});
  });
  const clearings = [[-4.65,-2.95],[2.85,4.80]].map(([a,b],i)=>({id:`shore-water-window-${i+1}`,kind:'water-view-window',clearance:0,polygon:[[a,0],[b,0],[b,16.5],[a,16.5]].map(p=>xianfaShoreWorldXZ(...p))}));
  return {id:xianfaShoreCommunitySpec.id,originXZ:[...origin],shoreLength:24,inlandDepth:16.5,shoreFrame:{tangentXZ:[...tangent],inlandXZ:[...inland]},footprint:[[-12,0],[12,0],[12,16.5],[-12,16.5]].map(p=>xianfaShoreWorldXZ(...p)),clearings,placements,
    contextIds:[...xianfaShoreCommunitySpec.willowIds],sourceGate:'R2-full-source-admitted-to-local-composition-review',historicallySurveyed:false,nativeCompositionReviewed:false};
}
