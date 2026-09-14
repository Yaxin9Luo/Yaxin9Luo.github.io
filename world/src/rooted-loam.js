import * as THREE from 'three';
import {herbariumCommunitySoilAt,herbariumCommunitySoilCellBounds,herbariumArrivalReserved,nearestHerbariumPath,subscribeHerbariumCommunitySoil} from './herbarium-layout.js';

// Accepted in matched R12 native frames. UI comparisons change uniforms only.
export const ROOTED_LOAM_DEFAULT=1;
const size=1024,span=288,origin=-144,states=new WeakMap();
let cachedMask;
const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
function protectedWeight(x,z){
  // Reuse the authoritative reservation query instead of copying its rectangles.
  // A .40 m zero guard exceeds the .398 m bilinear texel-centre reach.
  if(herbariumArrivalReserved(x,z,.40))return 0;
  let reserved=1;
  if(herbariumArrivalReserved(x,z,.70)){
    let low=.40,high=.70;
    for(let i=0;i<12;i++){const mid=(low+high)/2;if(herbariumArrivalReserved(x,z,mid))high=mid;else low=mid;}
    reserved=smooth(.40,.70,(low+high)/2);
  }
  const path=nearestHerbariumPath(x,z);
  return reserved*smooth(.40,.70,path.distance-path.path.width/2);
}
function acquireMask(){
  if(cachedMask){cachedMask.users++;return cachedMask;}
  const data=new Uint8Array(size*size),texture=new THREE.DataTexture(data,size,size,THREE.RedFormat,THREE.UnsignedByteType);
  texture.name='Accepted rooted-plant soil mask';texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.userData.sharedAsset=true;
  const mask={texture,users:1,revision:0,occupiedCells:0,sampledTexels:0,nonzeroTexels:0};
  const refresh=()=>{
    data.fill(0);const cells=herbariumCommunitySoilCellBounds();mask.occupiedCells=cells.length;mask.sampledTexels=0;mask.nonzeroTexels=0;
    for(const [minX,minZ,maxX,maxZ]of cells){
      // Half-open cells give each texel centre exactly one owner. The registry
      // already expands cells for the actual projected hull's soil feather.
      const x0=Math.max(0,Math.ceil((minX-origin)/span*size-.5)),x1=Math.min(size,Math.ceil((maxX-origin)/span*size-.5));
      const z0=Math.max(0,Math.ceil((minZ-origin)/span*size-.5)),z1=Math.min(size,Math.ceil((maxZ-origin)/span*size-.5));
      for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
        const wx=(x+.5)/size*span+origin,wz=(z+.5)/size*span+origin,soil=herbariumCommunitySoilAt(wx,wz);mask.sampledTexels++;
        const value=soil?Math.round(soil*protectedWeight(wx,wz)*255):0;data[z*size+x]=value;if(value)mask.nonzeroTexels++;
      }
    }
    mask.revision++;texture.needsUpdate=true;
  };
  refresh();const unsubscribe=subscribeHerbariumCommunitySoil(refresh);
  texture.addEventListener('dispose',()=>{unsubscribe();if(cachedMask===mask)cachedMask=undefined;});cachedMask=mask;return mask;
}

const fragment=`
  // The original full humus sample precedes c0.5; no derivative-dependent
  // texture sampling moves into the varying near-black guard below.
  float acceptedRoot=smoothstep(.40,.78,texture2D(rootedSoilMap,(terrainPosition.xz+vec2(144.))/288.).r);
  float loamMask=acceptedRoot*smoothstep(.20,.60,humusWeight)*(1.-mossWeight);
  vec3 currentSoil=diffuseColor.rgb;
  vec3 warmSource=sourceHumusColor*diffuse*vec3(1.08,1.,.88);
  float currentY=dot(currentSoil,meadowLuminanceWeights),warmY=dot(warmSource,meadowLuminanceWeights);
  if(currentY>1e-6&&warmY>1e-6){
    vec3 equalValueWarm=warmSource*(currentY/warmY);
    vec3 rootedLoam=mix(currentSoil,equalValueWarm,.35)*.90;
    diffuseColor.rgb=mix(currentSoil,rootedLoam,rootedLoamStrength*loamMask);
  }
`;
export function bindRootedLoamMaterial(material){
  if(states.has(material))return states.get(material).apply;
  const state={strength:{value:ROOTED_LOAM_DEFAULT},mask:null,disposed:false,apply:null};states.set(material,state);
  const release=()=>{
    if(state.disposed)return;state.disposed=true;material.removeEventListener('dispose',release);states.delete(material);
    if(state.mask&&--state.mask.users===0)state.mask.texture.dispose();state.mask=null;
  };
  material.addEventListener('dispose',release);
  state.apply=shader=>{
    if(state.disposed)throw new Error('Rooted loam material is disposed');
    const anchor='#include <color_fragment>';
    if(shader.fragmentShader.split(anchor).length!==2||!shader.fragmentShader.includes('vec3 sourceHumusColor=')||!shader.fragmentShader.includes('vec3 matchedSource='))throw new Error('Rooted loam requires the current terrain shader after source chroma');
    if(shader.uniforms.rootedSoilMap)throw new Error('Rooted loam is already applied');
    state.mask ||= acquireMask();shader.uniforms.rootedSoilMap={value:state.mask.texture};shader.uniforms.rootedLoamStrength=state.strength;
    shader.fragmentShader='uniform sampler2D rootedSoilMap; uniform float rootedLoamStrength;\n'+shader.fragmentShader.replace(anchor,fragment+anchor);
  };
  return state.apply;
}
function boundMaterials(root){
  const materials=new Set();root.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(states.has(material))materials.add(material);});return materials;
}
export function setRootedLoamStrength(root,value){
  if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Rooted loam strength must be between 0 and 1');
  const materials=boundMaterials(root);for(const material of materials)states.get(material).strength.value=value;return materials.size;
}
export function getRootedLoamState(root){
  const materials=[...boundMaterials(root)],mask=materials.map(material=>states.get(material).mask).find(Boolean);
  return {reviewStatus:'accepted-r12',defaultStrength:ROOTED_LOAM_DEFAULT,materials:materials.map(material=>({id:material.uuid,name:material.name,strength:states.get(material).strength.value,compiled:Boolean(states.get(material).mask)})),mask:mask?{width:size,height:size,bytes:size*size,revision:mask.revision,occupiedCells:mask.occupiedCells,sampledTexels:mask.sampledTexels,nonzeroTexels:mask.nonzeroTexels}:null};
}
