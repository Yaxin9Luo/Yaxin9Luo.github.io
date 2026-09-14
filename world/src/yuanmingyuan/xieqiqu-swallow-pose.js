import * as THREE from 'three';
import {organicLoft} from './yuanyingguan-geometry.js';
import {swallowWingHeight} from './xieqiqu-swallow-feathers.js';

// This authoring candidate is used only by its separate review factory.
// Neither the historical plate nor the institutional descriptions determines
// a leg length or wing joint angle. The existing fountain outlet is fixed.
const smooth=THREE.MathUtils.smoothstep;
export const swallowPoseStatus='authored-proportion-candidate; not-native-reviewed; not-integrated';
export const swallowPoseMouth=Object.freeze([0,.587,.579]);
export const swallowPoseBodyDrop=z=>.185*(1-smooth(z,.12,.38));

/** A shear, not a scale: each original section retains its width, height,
 * mouth cavity and relief. The front head and the entire beak stay fixed. */
export function poseSwallowBodyPoint(point,target=new THREE.Vector3()){
  return target.set(point.x,point.y-swallowPoseBodyDrop(point.z),point.z);
}

export function swallowPoseWingSweep(x){
  const u=Math.abs(x);
  return smooth(u,.11,.17)*(-.065*Math.exp(-(((u-.25)/.11)**2))+.095*Math.exp(-(((u-.50)/.14)**2))-.024*smooth(u,.78,1.10));
}

export function swallowPoseWingHeight(x,z){
  return swallowWingHeight(.10,z)-swallowPoseBodyDrop(z)+wingCentre(Math.abs(x)).y;
}

const wingAngle=x=>.63*smooth(x,.10,.25)-.53*smooth(x,.45,.70)-.12*smooth(x,.93,1.16),wingStep=.0005;
const wingArc=Array.from({length:2801},()=>new THREE.Vector2());
for(let i=1;i<wingArc.length;i++){const angle=wingAngle((i-.5)*wingStep);wingArc[i].copy(wingArc[i-1]).add(new THREE.Vector2(Math.cos(angle),Math.sin(angle)).multiplyScalar(wingStep));}
function wingCentre(x){
  const at=Math.min(wingArc.length-2,Math.max(0,Math.floor(x/wingStep))),t=(x-at*wingStep)/wingStep;
  return wingArc[at].clone().lerp(wingArc[at+1],t);
}

/** The centreline is integrated from shoulder/forearm/wrist tangent angles.
 * Local thin sections rotate with that tangent instead of becoming a tall
 * vertically stretched sheet. Geometry, relief and normal seams stay explicit. */
export function poseSwallowWingPoint(point,target=new THREE.Vector3()){
  const x=Math.abs(point.x),base=swallowWingHeight(x,point.z),h=point.y-base,centre=wingCentre(x),angle=wingAngle(x),sign=point.x<0?-1:1;
  const rootOffset=swallowWingHeight(x,point.z)-swallowWingHeight(.10,point.z);
  return target.set(sign*(centre.x-h*Math.sin(angle)),swallowPoseWingHeight(x,point.z)+h*Math.cos(angle)+rootOffset*(1-smooth(x,.10,.23)),point.z+swallowPoseWingSweep(x));
}

// A graduated fan: the second outer primary is longest and the inner ones
// shorten towards the wrist. These are authored dimensions, not measurements.
export const swallowPosePrimaryTips=Object.freeze([
  [1.055,-.605],[1.10,-.715],[1.04,-.770],[.94,-.765],
  [.805,-.690],[.650,-.600],[.515,-.475],
].map(p=>Object.freeze(p)));

function splitFeatherCapSeams(geometry){
  const {steps,sides}=geometry.userData,skinIndices=steps*sides*6,ids=geometry.index.array.slice(),original=geometry.attributes.position.count;
  // The actual flat terminal disks meet the lenticular skin at a sharp edge.
  // A strong pose shear exposes the error from averaging across that edge.
  // Duplicate only cap rim vertices; every triangle coordinate is preserved.
  for(const [name,attribute]of Object.entries(geometry.attributes)){
    if(name==='normal')continue;const array=new attribute.array.constructor((original+sides*2)*attribute.itemSize);array.set(attribute.array);
    for(let end=0;end<2;end++)for(let j=0;j<sides;j++)for(let c=0;c<attribute.itemSize;c++)array[(original+end*sides+j)*attribute.itemSize+c]=attribute.array[(end*steps*sides+j)*attribute.itemSize+c];
    geometry.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
  }
  for(let i=skinIndices;i<ids.length;i++){
    const at=ids[i];if(at<sides)ids[i]=original+at;
    else if(at>=steps*sides&&at<(steps+1)*sides)ids[i]=original+sides+at-steps*sides;
  }
  geometry.setIndex(new THREE.BufferAttribute(ids,1));geometry.deleteAttribute('normal');
  geometry.userData.poseCapSeams={retainedSkinIndexCount:skinIndices,originalVertices:original,addedVertices:sides*2,trianglePositionsUnchanged:true};
}

function restoreUnusedEyeNormals(geometry,sourceNormals){
  const p=geometry.attributes.position,n=geometry.attributes.normal,used=new Uint8Array(p.count),normal=new THREE.Vector3();let restored=0;
  for(const index of geometry.index.array)used[index]=1;
  for(let i=0;i<p.count;i++)if(!used[i]){
    // SphereGeometry includes two pole vertices that no triangle references.
    // computeVertexNormals has no faces to accumulate there. Restore only
    // those vertices; every rendered position/index/normal stays unchanged.
    normal.fromBufferAttribute(sourceNormals,i);
    const z=p.getZ(i),t=(z-.12)/(.38-.12),derivative=z>.12&&z<.38?-.185*6*t*(1-t)/(.38-.12):0;
    normal.z+=derivative*normal.y; // inverse transpose of y' = y - drop(z)
    if(!normal.toArray().every(Number.isFinite)||normal.lengthSq()===0)throw new Error('Unused eye vertices require finite original normals');
    normal.normalize();n.setXYZ(i,normal.x,normal.y,normal.z);restored++;
  }
  n.needsUpdate=true;geometry.userData.poseUnusedEyeNormals=restored;
}

/** Mutates only the freshly-created candidate geometry owned by the caller.
 * UVs and every face are retained, with separate normals on actual feather
 * terminal disks; no source geometry or material is disposed. */
export function applySwallowPose(geometry,part,{primaryIndex=null}={}){
  if(!geometry?.isBufferGeometry||!['body','wing','feather','tail','eye'].includes(part))throw new Error('A fresh geometry and a supported swallow part are required');
  if(geometry.userData.pose)throw new Error('A swallow candidate geometry may be posed only once');
  const position=geometry.attributes.position,p=new THREE.Vector3(),isWing=part==='wing'||part==='feather',sourceEyeNormals=part==='eye'?geometry.attributes.normal.clone():null;
  const {steps,sides,root,tip}=geometry.userData;
  if(primaryIndex!==null&&(!Number.isInteger(primaryIndex)||!swallowPosePrimaryTips[primaryIndex]||!steps||!sides||!root||!tip))throw new Error('Primary posing needs the actual feather rings and a valid primary index');
  for(let i=0;i<position.count;i++){
    p.fromBufferAttribute(position,i);
    if(primaryIndex!==null){
      const row=i<(steps+1)*sides?Math.floor(i/sides):(i===(steps+1)*sides?0:steps),t=row/steps,weight=smooth(t,.22,1),sign=Math.sign(tip[0]);
      const [newX,newZ]=swallowPosePrimaryTips[primaryIndex],oldHeight=swallowWingHeight(p.x,p.z);
      p.x+=weight*(sign*newX-tip[0]);p.z+=weight*(newZ-tip[2]);
      p.y+=swallowWingHeight(p.x,p.z)-oldHeight;
    }
    (isWing?poseSwallowWingPoint:poseSwallowBodyPoint)(p,p);position.setXYZ(i,p.x,p.y,p.z);
  }
  position.needsUpdate=true;if(part==='feather')splitFeatherCapSeams(geometry);geometry.computeVertexNormals();if(sourceEyeNormals)restoreUnusedEyeNormals(geometry,sourceEyeNormals);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...geometry.userData,pose:swallowPoseStatus,posePart:part,primaryIndex};return geometry;
}

export function swallowPoseLegSections(side){
  if(![-1,1].includes(side))throw new Error('Swallow leg side must be -1 or 1');
  return [[side*.055,.300,.022,.026,.032],[side*.058,.235,.028,.024,.026],
    [side*.063,.180,.002,.020,.023],[side*.065,.130,-.013,.014,.016],
    [side*.063,.086,.034,.010,.012],
    [side*.059,.050,.092,.015,.017],[side*.060,.031,.105,.018,.019],
    [side*.060,.013,.116,.010,.011]];
}

export function createBentSwallowLegGeometry(side){
  const geometry=organicLoft(swallowPoseLegSections(side),32,96,0,.002);
  geometry.name=`xieqiqu-swallow-short-bent-leg-candidate-${side}`;
  geometry.userData={...geometry.userData,pose:swallowPoseStatus,sections:swallowPoseLegSections(side),sides:32,steps:96};return geometry;
}
