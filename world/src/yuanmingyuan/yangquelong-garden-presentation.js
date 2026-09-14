import * as THREE from 'three';
import {yangquelongGardenViews} from './yangquelong-garden-layout.js';
import {fitGardenCompositionView} from './yangquelong-garden-framing.js';
import {fitStudyShadow} from './shadow-framing.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const high=(x,z)=>[x,Math.hypot(x,z)*Math.tan(THREE.MathUtils.degToRad(32)),z];
export const yangquelongPavingReviewViews=freeze({
 ...yangquelongGardenViews,
 gardenhigh:{label:'高位完整庭园 · Higher complete garden',groups:[],direction:high(-1,.45),margin:1.06,framing:'complete-mesh-bounds'},
 gardeneast:{label:'东向完整庭园 · East-side complete garden',groups:[],direction:high(1,-.45),margin:1.06,framing:'complete-mesh-bounds'},
});
export {fitGardenCompositionView};
export const yangquelongGardenPresentationSpec=freeze({
 id:'yangquelong-garden-presentation-r1',mode:'day',exposure:1,
 background:'#cbd0d2',floor:'#b2b7b7',
 key:{colour:'#ffeed6',intensity:3.15,direction:[-1,.95,.60]},
 fill:{colour:'#dce7f0',intensity:.14,direction:[1,.55,-.65]},
 hemisphere:{sky:'#dce7ed',ground:'#a49c90',intensity:.36},
 geometryOrTextureChanges:0,environmentIntensity:'unchanged',shadowResolution:'unchanged',
 evidence:'independent contemporary studio presentation; not reference-image reproduction',
 nativeReviewed:false,
});
const spec=yangquelongGardenPresentationSpec;
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong presentation: '+message);};
/** Explicit day-review lease. The caller owns all studio resources and must
 * release this before changing assets/light mode. No production default or
 * renderer-quality setting is patched. It returns the real shadow fit for the
 * caller's diagnostics, and restores every changed field when released. */
export function applyYangquelongGardenPresentation({scene,floor,key,fill,hemi,renderer,receiverBounds,casterBounds=receiverBounds,signal}={}){
 signal?.throwIfAborted();
 fail(scene?.isScene&&floor?.material?.color&&key?.isDirectionalLight&&fill?.isDirectionalLight&&hemi?.isHemisphereLight&&receiverBounds?.isBox3&&!receiverBounds.isEmpty()&&casterBounds?.isBox3&&!casterBounds.isEmpty(),'complete owned studio frame required');
 fail(renderer?.toneMappingExposure===1,'baseline exposure 1 required');
 const shadow=key.shadow.camera,shadowFields=['left','right','top','bottom','near','far'];
 const original={background:scene.background,floor:floor.material.color.clone(),keyColour:key.color.clone(),keyIntensity:key.intensity,keyPosition:key.position.clone(),keyTarget:key.target.position.clone(),
  fillColour:fill.color.clone(),fillIntensity:fill.intensity,fillPosition:fill.position.clone(),fillTarget:fill.target.position.clone(),
  hemiColour:hemi.color.clone(),hemiGround:hemi.groundColor.clone(),hemiIntensity:hemi.intensity,
  shadow:Object.fromEntries(shadowFields.map(k=>[k,shadow[k]])),bias:key.shadow.bias,normalBias:key.shadow.normalBias};
 const background=new THREE.Color(spec.background),floorColour=new THREE.Color(spec.floor);
 let disposed=false;
 function dirty(){key.target.updateMatrixWorld(true);key.updateMatrixWorld(true);fill.target.updateMatrixWorld(true);fill.updateMatrixWorld(true);shadow.updateProjectionMatrix();key.shadow.updateMatrices(key);key.shadow.needsUpdate=true;if(renderer.shadowMap)renderer.shadowMap.needsUpdate=true;}
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  if(scene.background===background)scene.background=original.background;
  if(floor.material.color.equals(floorColour))floor.material.color.copy(original.floor);
  key.color.copy(original.keyColour);key.intensity=original.keyIntensity;key.position.copy(original.keyPosition);key.target.position.copy(original.keyTarget);
  fill.color.copy(original.fillColour);fill.intensity=original.fillIntensity;fill.position.copy(original.fillPosition);fill.target.position.copy(original.fillTarget);
  hemi.color.copy(original.hemiColour);hemi.groundColor.copy(original.hemiGround);hemi.intensity=original.hemiIntensity;
  Object.assign(shadow,original.shadow);key.shadow.bias=original.bias;key.shadow.normalBias=original.normalBias;dirty();
 }
 try{
  scene.background=background;floor.material.color.copy(floorColour);
  const centre=receiverBounds.getCenter(new THREE.Vector3()),distance=Math.max(30,casterBounds.getSize(new THREE.Vector3()).length()*2);
  key.color.set(spec.key.colour);key.intensity=spec.key.intensity;key.target.position.copy(centre);
  key.position.copy(centre).addScaledVector(new THREE.Vector3(...spec.key.direction).normalize(),distance);
  fill.color.set(spec.fill.colour);fill.intensity=spec.fill.intensity;fill.target.position.copy(centre);
  fill.position.copy(centre).addScaledVector(new THREE.Vector3(...spec.fill.direction).normalize(),distance);
  hemi.color.set(spec.hemisphere.sky);hemi.groundColor.set(spec.hemisphere.ground);hemi.intensity=spec.hemisphere.intensity;
  const shadowSetup=fitStudyShadow(key,receiverBounds,casterBounds);dirty();
  signal?.addEventListener('abort',dispose,{once:true});signal?.throwIfAborted();
  return {spec,shadowSetup,dispose,get disposed(){return disposed;},diagnostics:{presentation:spec,keyPosition:key.position.toArray(),keyTarget:key.target.position.toArray(),fillPosition:fill.position.toArray(),exposure:renderer.toneMappingExposure,shadowSetup}};
 }catch(error){dispose();throw error;}
}
