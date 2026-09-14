import {yangquelongPavingReviewViews} from './yangquelong-garden-presentation.js';
import {gardenFramingPoints,fitGardenPoints,fitGardenCompositionView} from './yangquelong-garden-framing.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const yangquelongRefinedGardenViews=freeze({
 ...yangquelongPavingReviewViews,
 courtyard:{label:'南侧花床与水院 · Southern bed and water court',groups:[],direction:[-1,.75,.72],margin:1.08,
  focusGroups:['pine-west-south','understorey-bed-west-south','yangquelong-west-pool-south'],framing:'existing-mesh-bounds-focus',isolation:false},
});
/** A close camera focuses existing geometry while the complete composition
 * remains visible/loaded. Whole views reuse the original complete-bounds fit. */
export function frameYangquelongRefinedGarden({group,camera,controls,spec}){
 if(!spec.focusGroups)return fitGardenCompositionView({group,camera,controls,spec});
 if(spec.groups.length||spec.isolate?.length||spec.crop)throw new Error('Refined courtyard focus must not isolate or crop geometry');
 const points=[],groups=[];
 for(const name of spec.focusGroups){
  const node=group.getObjectByName(name);if(!node)throw new Error('Missing original courtyard group '+name);
  const cloud=gardenFramingPoints(node);points.push(...cloud.points);groups.push({name,meshes:cloud.meshes,instances:cloud.instances});
 }
 const fit=fitGardenPoints(points,{direction:spec.direction,aspect:camera.aspect,fov:camera.getEffectiveFOV(),margin:spec.margin});
 camera.position.copy(fit.position);camera.far=Math.max(1200,fit.farthestDepth*2);camera.updateProjectionMatrix();
 const damping=controls.enableDamping;controls.enableDamping=false;
 try{controls.target.copy(fit.target);controls.maxDistance=Math.max(400,camera.position.distanceTo(fit.target)*3);controls.update();camera.updateMatrixWorld(true);}
 finally{controls.enableDamping=damping;}
 return {...fit,position:fit.position.toArray(),target:fit.target.toArray(),groups,method:'existing-pine-bed-water-mesh-bounds-focus',geometryHidden:0};
}
